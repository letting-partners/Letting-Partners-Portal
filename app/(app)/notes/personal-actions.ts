"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAccess } from "@/services/permissions";
import {
  createPersonalNote,
  deletePersonalNote,
  PersonalNoteError,
  updatePersonalNote,
} from "@/services/personal-notes";

/**
 * A user's own scratchpad. Every action resolves the owner from the session
 * rather than taking a user id, so one user cannot reach another's notes.
 */

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof PersonalNoteError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  const issues = (error as { issues?: { message?: string }[] })?.issues;
  if (error instanceof Error && error.name === "ZodError" && Array.isArray(issues)) {
    return { ok: false, error: issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Personal note action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const noteSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  body: z.string().max(50_000).optional().nullable(),
  pinned: z.boolean().optional(),
});

export async function createPersonalNoteAction(
  input: z.input<typeof noteSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = noteSchema.parse(input);
    const context = await requireAccess();
    const note = await createPersonalNote(parsed, context);

    revalidatePath("/notes");
    return { ok: true, data: note };
  } catch (error) {
    return fail(error);
  }
}

export async function updatePersonalNoteAction(
  id: string,
  input: z.input<typeof noteSchema>,
): Promise<ActionResult> {
  try {
    const parsed = noteSchema.parse(input);
    const context = await requireAccess();
    await updatePersonalNote(id, parsed, context);

    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePersonalNoteAction(id: string): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await deletePersonalNote(id, context);

    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
