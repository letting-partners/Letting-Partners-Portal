"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { noteEntityEnum } from "@/db/schema";
import { ForbiddenError, requireAccess } from "@/services/permissions";
import { addNote, deleteNote, editNote, NoteError } from "@/services/notes";

/** Notes can be attached to any record, so these actions are shared. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof NoteError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You can only edit your own notes." };
  }
  console.error("Note action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const addSchema = z.object({
  entityType: z.enum(noteEntityEnum.enumValues),
  entityId: z.string().uuid(),
  body: z.string().trim().min(1, "Write something before saving the note.").max(5000),
  /** Path to refresh so the new note appears immediately. */
  revalidate: z.string().optional(),
});

export async function addNoteAction(input: {
  entityType: string;
  entityId: string;
  body: string;
  revalidate?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = addSchema.parse(input);
    const context = await requireAccess();
    const note = await addNote(
      { entityType: parsed.entityType, entityId: parsed.entityId, body: parsed.body },
      context,
    );
    if (parsed.revalidate) revalidatePath(parsed.revalidate);
    return { ok: true, data: note };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Check the note." };
    }
    return fail(error);
  }
}

export async function editNoteAction(
  noteId: string,
  body: string,
  revalidate?: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await editNote(noteId, body, context);
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteNoteAction(
  noteId: string,
  revalidate?: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await deleteNote(noteId, context);
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
