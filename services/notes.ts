import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activities, notes, users, type noteEntityEnum } from "@/db/schema";
import { ENTITY, recordActivity } from "./audit";
import { ForbiddenError, type AccessContext } from "./permissions";

/**
 * Internal notes, attachable to any record. Editing keeps the previous text in
 * `editHistory` rather than overwriting it, so the trail of what was said and
 * when survives.
 */

export type NoteEntity = (typeof noteEntityEnum.enumValues)[number];

export class NoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteError";
  }
}

export async function addNote(
  input: { entityType: NoteEntity; entityId: string; body: string },
  context: AccessContext,
): Promise<{ id: string }> {
  if (!input.body.trim()) throw new NoteError("Write something before saving the note.");

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(notes)
      .values({
        entityType: input.entityType,
        entityId: input.entityId,
        body: input.body.trim(),
        authorId: context.user.id,
      })
      .returning({ id: notes.id });

    await recordActivity(
      {
        type: "NOTE_ADDED",
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: context.user.id,
        summary: `${context.user.fullName} added a note`,
      },
      tx,
    );

    return { id: inserted[0].id };
  });
}

export async function listNotes(entityType: NoteEntity, entityId: string) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      editHistory: notes.editHistory,
      authorId: notes.authorId,
      authorName: users.fullName,
      authorAvatar: users.avatarUrl,
    })
    .from(notes)
    .innerJoin(users, eq(users.id, notes.authorId))
    .where(and(eq(notes.entityType, entityType), eq(notes.entityId, entityId), isNull(notes.deletedAt)))
    .orderBy(desc(notes.createdAt));
}

/** Authors may edit their own notes; admins may edit any. */
export async function editNote(
  noteId: string,
  body: string,
  context: AccessContext,
): Promise<void> {
  if (!body.trim()) throw new NoteError("A note cannot be empty.");

  const rows = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  const note = rows[0];
  if (!note || note.deletedAt) throw new NoteError("That note no longer exists.");
  if (note.authorId !== context.user.id && !context.isAdmin) throw new ForbiddenError();

  const history = Array.isArray(note.editHistory) ? note.editHistory : [];

  await db
    .update(notes)
    .set({
      body: body.trim(),
      updatedAt: new Date(),
      editHistory: [
        ...history,
        { body: note.body, editedAt: new Date().toISOString(), editedBy: context.user.id },
      ] as never,
    })
    .where(eq(notes.id, noteId));
}

export async function deleteNote(noteId: string, context: AccessContext): Promise<void> {
  const rows = await db.select().from(notes).where(eq(notes.id, noteId)).limit(1);
  const note = rows[0];
  if (!note) throw new NoteError("That note no longer exists.");
  if (note.authorId !== context.user.id && !context.isAdmin) throw new ForbiddenError();

  // Soft delete so the note can be recovered and the trail stays intact.
  await db.update(notes).set({ deletedAt: new Date() }).where(eq(notes.id, noteId));
}

/* ------------------------------------------------------------- timeline */

/** The activity feed for one record, newest first. */
export async function listActivity(entityType: string, entityId: string, limit = 50) {
  return db
    .select({
      id: activities.id,
      type: activities.type,
      summary: activities.summary,
      metadata: activities.metadata,
      createdAt: activities.createdAt,
      actorId: activities.actorId,
      actorName: users.fullName,
      actorAvatar: users.avatarUrl,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.actorId))
    .where(and(eq(activities.entityType, entityType), eq(activities.entityId, entityId)))
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

export { ENTITY };
