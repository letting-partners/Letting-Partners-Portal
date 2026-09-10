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
import NoteRowActions from "./NoteRowActions";
import PersonalNotes from "./PersonalNotes";
import { listPersonalNotes } from "@/services/personal-notes";

export const metadata: Metadata = { title: "Notes" };

/** Where a note lives, so each one links back to its record. */
const ENTITY_ROUTES: Record<string, string> = {
  LANDLORD: "/landlords",
  PROPERTY: "/properties",
  TENANT: "/tenants",
};

type View = "records" | "personal";

const VIEWS: { key: View; label: string }[] = [
  { key: "records", label: "Record notes" },
  { key: "personal", label: "My notes" },
];

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const context = await pageAccess();
  const params = await searchParams;
  const view: View = params.view === "personal" ? "personal" : "records";

  const personal = view === "personal" ? await listPersonalNotes(context) : [];

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
          view === "personal"
            ? "Your own scratchpad. Nobody else can see these, including administrators."
            : context.isAdmin
              ? "Every internal note across the business, newest first."
              : "The notes you have written, newest first."
        }
      />

      <nav className="tabs" style={{ marginBottom: 16 }} aria-label="Notes views">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "records" ? "/notes" : `/notes?view=${item.key}`}
            className="tab"
            aria-selected={view === item.key}
            role="tab"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {view === "personal" ? (
        <PersonalNotes
          notes={personal.map((note) => ({
            id: note.id,
            title: note.title,
            body: note.body,
            pinned: note.pinned,
            updatedAt: note.updatedAt.toISOString(),
          }))}
        />
      ) : (
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
                    <span className="row" style={{ gap: 6 }}>
                      <span className="subtle small" title={formatDateTime(note.createdAt)}>
                        {formatRelative(note.createdAt)}
                      </span>
                      <NoteRowActions
                        noteId={note.id}
                        body={note.body}
                        canManage={context.isAdmin || note.authorId === context.user.id}
                      />
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
      )}
    </>
  );
}
