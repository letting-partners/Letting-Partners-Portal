import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notes, users } from "@/db/schema";
import { StickyNote } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateTime, formatRelative } from "@/lib/dates";

export const metadata: Metadata = { title: "Notes" };

/** Where a note lives, so each one links back to its record. */
const ENTITY_ROUTES: Record<string, string> = {
  LANDLORD: "/landlords",
  PROPERTY: "/properties",
  TENANT: "/tenants",
};

export default async function NotesPage() {
  const context = await pageAccess();

  // A user sees the notes they wrote; an administrator sees everything.
  const rows = await db
    .select({
      id: notes.id,
      entityType: notes.entityType,
      entityId: notes.entityId,
      body: notes.body,
      createdAt: notes.createdAt,
      authorId: notes.authorId,
      authorName: users.fullName,
      authorAvatar: users.avatarUrl,
    })
    .from(notes)
    .innerJoin(users, eq(users.id, notes.authorId))
    .where(
      context.isAdmin
        ? isNull(notes.deletedAt)
        : eq(notes.authorId, context.user.id),
    )
    .orderBy(desc(notes.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={
          context.isAdmin
            ? "Every internal note across the business, newest first."
            : "The notes you have written, newest first."
        }
      />

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState
            icon={<StickyNote size={18} />}
            title="No notes yet"
            message="Notes can be added to landlords, properties, tenants and deals. They are internal and never appear on the website."
          />
        ) : (
          <ul>
            {rows.map((note) => {
              const route = ENTITY_ROUTES[note.entityType];
              return (
                <li key={note.id} style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div className="row row--between" style={{ marginBottom: 5 }}>
                    <span className="person">
                      <Avatar name={note.authorName} src={note.authorAvatar} size="sm" />
                      <span className="person-name">{note.authorName}</span>
                      <span className="badge badge--neutral">
                        {note.entityType.toLowerCase()}
                      </span>
                    </span>
                    <span className="subtle small" title={formatDateTime(note.createdAt)}>
                      {formatRelative(note.createdAt)}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.87rem", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                    {note.body}
                  </p>

                  {route && (
                    <Link
                      href={`${route}/${note.entityId}`}
                      className="small"
                      style={{ textDecoration: "underline", color: "var(--text-muted)" }}
                    >
                      Open record
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
