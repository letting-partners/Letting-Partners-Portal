import "server-only";
import { and, desc, eq, ilike, ne, or, sql as raw, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, users } from "@/db/schema";
import { ENTITY, recordAudit } from "./audit";
import { ForbiddenError, type AccessContext } from "./permissions";
import { htmlToText, readingMinutes, sanitizeHtml, slugify } from "./blog-content";

export { htmlToText, readingMinutes, sanitizeHtml, slugify };

/**
 * Articles for the public website.
 *
 * Writing is an admin job, so the permission model is simply "admin or not" -
 * unlike properties, an article has no owning agent and nothing depends on who
 * touched it last.
 */

export class BlogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlogError";
  }
}

export type BlogStatus = "DRAFT" | "PUBLISHED" | "TRASHED";

/** A slug no live post is already using. */
async function uniqueSlug(desired: string, exceptId?: string): Promise<string> {
  const base = slugify(desired) || "post";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const clash = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, candidate),
          ne(blogPosts.status, "TRASHED"),
          exceptId ? ne(blogPosts.id, exceptId) : undefined,
        ),
      )
      .limit(1);

    if (!clash[0]) return candidate;
  }

  throw new BlogError("Could not find a free URL for that title. Try a different one.");
}

/* -------------------------------------------------------------- writing */

export type BlogInput = {
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  body: string;
  bannerImageUrl?: string | null;
  bannerImageAlt?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  schemaJson?: string | null;
  status?: BlogStatus;
  publishedAt?: string | null;
};

function assertAdmin(context: AccessContext) {
  if (!context.isAdmin) throw new ForbiddenError();
}

/** Reject invalid JSON up front rather than shipping it to the website. */
function normalizeSchema(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed));
  } catch {
    throw new BlogError("The custom schema is not valid JSON.");
  }
}

function assertPublishable(input: { title: string; body: string; bannerImageUrl?: string | null }) {
  if (!input.title.trim()) throw new BlogError("Give the article a title.");
  if (htmlToText(input.body).length < 50) {
    throw new BlogError("Write the article before publishing it.");
  }
  if (!input.bannerImageUrl) {
    throw new BlogError("Add a banner image before publishing.");
  }
}

export async function createBlogPost(
  input: BlogInput,
  context: AccessContext,
): Promise<{ id: string; slug: string }> {
  assertAdmin(context);
  if (!input.title.trim()) throw new BlogError("Give the article a title.");

  const status = input.status ?? "DRAFT";
  const body = sanitizeHtml(input.body ?? "");
  if (status === "PUBLISHED") {
    assertPublishable({ title: input.title, body, bannerImageUrl: input.bannerImageUrl });
  }

  const slug = await uniqueSlug(input.slug || input.title);

  const inserted = await db
    .insert(blogPosts)
    .values({
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || null,
      body,
      bannerImageUrl: input.bannerImageUrl || null,
      bannerImageAlt: input.bannerImageAlt?.trim() || null,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      focusKeyword: input.focusKeyword?.trim() || null,
      schemaJson: normalizeSchema(input.schemaJson),
      status,
      publishedAt: input.publishedAt
        ? new Date(input.publishedAt)
        : status === "PUBLISHED"
          ? new Date()
          : null,
      authorId: context.user.id,
    })
    .returning({ id: blogPosts.id, slug: blogPosts.slug });

  const post = inserted[0];

  await recordAudit({
    user: context.user,
    action: "CREATE",
    entityType: ENTITY.blogPost,
    entityId: post.id,
    entityLabel: input.title.trim(),
  });

  return post;
}

export async function updateBlogPost(
  id: string,
  input: BlogInput,
  context: AccessContext,
): Promise<{ slug: string }> {
  assertAdmin(context);

  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) throw new BlogError("That article no longer exists.");

  const status = input.status ?? existing.status;
  const body = sanitizeHtml(input.body ?? "");
  if (status === "PUBLISHED") {
    assertPublishable({
      title: input.title,
      body,
      bannerImageUrl: input.bannerImageUrl ?? existing.bannerImageUrl,
    });
  }

  const slug =
    input.slug && slugify(input.slug) !== existing.slug
      ? await uniqueSlug(input.slug, id)
      : existing.slug;

  await db
    .update(blogPosts)
    .set({
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || null,
      body,
      bannerImageUrl: input.bannerImageUrl || null,
      bannerImageAlt: input.bannerImageAlt?.trim() || null,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      focusKeyword: input.focusKeyword?.trim() || null,
      schemaJson: normalizeSchema(input.schemaJson),
      status,
      // Publishing for the first time dates the article now, unless the writer
      // has chosen a date themselves.
      publishedAt: input.publishedAt
        ? new Date(input.publishedAt)
        : status === "PUBLISHED"
          ? (existing.publishedAt ?? new Date())
          : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));

  await recordAudit({
    user: context.user,
    action: "UPDATE",
    entityType: ENTITY.blogPost,
    entityId: id,
    entityLabel: input.title.trim(),
    metadata: { status },
  });

  return { slug };
}

export async function setBlogStatus(
  id: string,
  status: BlogStatus,
  context: AccessContext,
): Promise<void> {
  assertAdmin(context);

  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  const existing = rows[0];
  if (!existing) throw new BlogError("That article no longer exists.");

  if (status === "PUBLISHED") {
    assertPublishable({
      title: existing.title,
      body: existing.body,
      bannerImageUrl: existing.bannerImageUrl,
    });
    // Coming back from the trash must not collide with a replacement.
    const slug = await uniqueSlug(existing.slug, id);
    if (slug !== existing.slug) {
      await db.update(blogPosts).set({ slug }).where(eq(blogPosts.id, id));
    }
  }

  await db
    .update(blogPosts)
    .set({
      status,
      publishedAt:
        status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, id));

  await recordAudit({
    user: context.user,
    action: status === "TRASHED" ? "ARCHIVE" : "UPDATE",
    entityType: ENTITY.blogPost,
    entityId: id,
    entityLabel: existing.title,
    metadata: { status },
  });
}

/* -------------------------------------------------------------- reading */

export async function listBlogPosts(
  context: AccessContext,
  filters: { status?: BlogStatus; search?: string } = {},
) {
  assertAdmin(context);

  const conditions: (SQL | undefined)[] = [];
  if (filters.status) conditions.push(eq(blogPosts.status, filters.status));
  else conditions.push(ne(blogPosts.status, "TRASHED"));

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(blogPosts.title, term), ilike(blogPosts.focusKeyword, term)));
  }

  const rows = await db
    .select({
      id: blogPosts.id,
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      status: blogPosts.status,
      focusKeyword: blogPosts.focusKeyword,
      bannerImageUrl: blogPosts.bannerImageUrl,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      authorName: users.fullName,
    })
    .from(blogPosts)
    .leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(and(...conditions))
    .orderBy(desc(raw`coalesce(${blogPosts.publishedAt}, ${blogPosts.updatedAt})`));

  const counts = await db
    .select({ status: blogPosts.status, value: raw<number>`count(*)::int` })
    .from(blogPosts)
    .groupBy(blogPosts.status);

  return {
    rows,
    counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.value)])) as Record<
      string,
      number
    >,
  };
}

export async function getBlogPost(id: string, context: AccessContext) {
  assertAdmin(context);
  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ------------------------------------------------------- public website */

/** Published, and not dated in the future. */
function livePostFilter() {
  return and(
    eq(blogPosts.status, "PUBLISHED"),
    raw`${blogPosts.publishedAt} is not null and ${blogPosts.publishedAt} <= now()`,
  );
}

export type PublicBlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  bannerImage: string | null;
  bannerImageAlt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  author: string | null;
  focusKeyword: string | null;
};

export async function listPublicBlogPosts(limit = 24, offset = 0): Promise<PublicBlogPost[]> {
  const rows = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      body: blogPosts.body,
      bannerImageUrl: blogPosts.bannerImageUrl,
      bannerImageAlt: blogPosts.bannerImageAlt,
      focusKeyword: blogPosts.focusKeyword,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      authorName: users.fullName,
    })
    .from(blogPosts)
    .leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(livePostFilter())
    .orderBy(desc(blogPosts.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 100))
    .offset(Math.max(offset, 0));

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? htmlToText(row.body).slice(0, 180),
    bannerImage: row.bannerImageUrl,
    bannerImageAlt: row.bannerImageAlt,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    readingMinutes: readingMinutes(row.body),
    author: row.authorName,
    focusKeyword: row.focusKeyword,
  }));
}

export async function getPublicBlogPost(slug: string) {
  const rows = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      body: blogPosts.body,
      bannerImageUrl: blogPosts.bannerImageUrl,
      bannerImageAlt: blogPosts.bannerImageAlt,
      metaTitle: blogPosts.metaTitle,
      metaDescription: blogPosts.metaDescription,
      focusKeyword: blogPosts.focusKeyword,
      schemaJson: blogPosts.schemaJson,
      publishedAt: blogPosts.publishedAt,
      updatedAt: blogPosts.updatedAt,
      authorName: users.fullName,
    })
    .from(blogPosts)
    .leftJoin(users, eq(users.id, blogPosts.authorId))
    .where(and(eq(blogPosts.slug, slug), livePostFilter()))
    .limit(1);

  const post = rows[0];
  if (!post) return null;

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? htmlToText(post.body).slice(0, 180),
    body: post.body,
    bannerImage: post.bannerImageUrl,
    bannerImageAlt: post.bannerImageAlt,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    focusKeyword: post.focusKeyword,
    schema: post.schemaJson ? (JSON.parse(post.schemaJson) as unknown) : null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    readingMinutes: readingMinutes(post.body),
    author: post.authorName,
  };
}

/** Slugs and dates for the website sitemap. */
export async function listPublicBlogSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await db
    .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
    .from(blogPosts)
    .where(livePostFilter())
    .orderBy(desc(blogPosts.updatedAt));

  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }));
}
