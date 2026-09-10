import "server-only";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { personalNotes } from "@/db/schema";
import type { AccessContext } from "./permissions";

/**
 * A private scratchpad, one per user.
 *
 * Every query filters by the owner and there is no admin override, which is
 * the whole point: a note somebody else can read is not personal. Nothing here
 * is audited either, for the same reason.
 */

export class PersonalNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersonalNoteError";
  }
}

/** Ownership is the only permission that matters here. */
function ownedBy(userId: string, noteId?: string) {
  return and(
    eq(personalNotes.userId, userId),
    isNull(personalNotes.deletedAt),
    noteId ? eq(personalNotes.id, noteId) : undefined,
  );
}

export async function listPersonalNotes(context: AccessContext, search?: string) {
  const conditions = [ownedBy(context.user.id)];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    const match = or(ilike(personalNotes.title, term), ilike(personalNotes.body, term));
    if (match) conditions.push(match);
  }

  return db
    .select({
      id: personalNotes.id,
      title: personalNotes.title,
      body: personalNotes.body,
      pinned: personalNotes.pinned,
      createdAt: personalNotes.createdAt,
      updatedAt: personalNotes.updatedAt,
    })
    .from(personalNotes)
    .where(and(...conditions))
    // Pinned first, then whatever was touched most recently.
    .orderBy(desc(personalNotes.pinned), desc(personalNotes.updatedAt));
}

export async function createPersonalNote(
  input: { title?: string | null; body?: string | null },
  context: AccessContext,
): Promise<{ id: string }> {
  const inserted = await db
    .insert(personalNotes)
    .values({
      userId: context.user.id,
      title: input.title?.trim() || null,
      body: input.body ?? "",
    })
    .returning({ id: personalNotes.id });

  return inserted[0];
}

export async function updatePersonalNote(
  id: string,
  input: { title?: string | null; body?: string | null; pinned?: boolean },
  context: AccessContext,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) patch.title = input.title?.trim() || null;
  if (input.body !== undefined) patch.body = input.body ?? "";
  if (input.pinned !== undefined) patch.pinned = input.pinned;

  const updated = await db
    .update(personalNotes)
    .set(patch)
    .where(ownedBy(context.user.id, id))
    .returning({ id: personalNotes.id });

  // No row means it is not theirs, which reads the same as not existing.
  if (updated.length === 0) throw new PersonalNoteError("That note no longer exists.");
}

export async function deletePersonalNote(id: string, context: AccessContext): Promise<void> {
  const deleted = await db
    .update(personalNotes)
    .set({ deletedAt: new Date() })
    .where(ownedBy(context.user.id, id))
    .returning({ id: personalNotes.id });

  if (deleted.length === 0) throw new PersonalNoteError("That note no longer exists.");
}
