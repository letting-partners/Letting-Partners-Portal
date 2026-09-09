import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { blogStatusEnum } from "./enums";
import { users } from "./users";

/**
 * Articles published on the public website.
 *
 * The status is the whole lifecycle: DRAFT while it is being written,
 * PUBLISHED once it is live, TRASHED when it is withdrawn. Trashed is a state
 * rather than a deletion so a withdrawn post can come back, and so a URL that
 * was live for a month does not simply vanish from the record.
 *
 * `publishedAt` is set by hand, not by the clock. Backdating an article and
 * scheduling one for next Tuesday are the same field, and the website decides
 * what to show by comparing it to now.
 */
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** The public URL segment. Unique across live posts. */
    slug: varchar("slug", { length: 220 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    /** Short summary for cards and listings. */
    excerpt: text("excerpt"),
    /** The article itself, as sanitised HTML from the editor. */
    body: text("body").notNull(),

    bannerImageUrl: text("banner_image_url"),
    bannerImageAlt: varchar("banner_image_alt", { length: 300 }),

    /* ---------------------------------------------------------------- seo */
    metaTitle: varchar("meta_title", { length: 240 }),
    metaDescription: varchar("meta_description", { length: 400 }),
    /** The term the article is written to rank for. */
    focusKeyword: varchar("focus_keyword", { length: 160 }),
    /**
     * Extra JSON-LD for this article, merged alongside the BlogPosting entity
     * the site generates. Stored as text so an invalid draft can be saved and
     * corrected rather than rejected outright.
     */
    schemaJson: text("schema_json"),

    status: blogStatusEnum("status").notNull().default("DRAFT"),
    /** When the article is dated. May be in the future. */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * One live post per slug. Trashed posts are excluded, so withdrawing an
     * article frees its URL for a replacement without having to rename it.
     */
    uniqueIndex("blog_posts_slug_live_key")
      .on(t.slug)
      .where(sql`${t.status} <> 'TRASHED'`),
    index("blog_posts_status_idx").on(t.status),
    index("blog_posts_published_at_idx").on(t.publishedAt),
  ],
);

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, { fields: [blogPosts.authorId], references: [users.id] }),
}));
