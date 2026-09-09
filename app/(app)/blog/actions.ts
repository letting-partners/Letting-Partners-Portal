"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/services/permissions";
import {
  BlogError,
  createBlogPost,
  setBlogStatus,
  updateBlogPost,
  type BlogStatus,
} from "@/services/blog";

/**
 * Actions behind the article editor.
 *
 * Writing for the public website is an admin job, so every one of these
 * requires an admin rather than checking ownership.
 */

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof BlogError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  const issues = (error as { issues?: { message?: string }[] })?.issues;
  if (error instanceof Error && error.name === "ZodError" && Array.isArray(issues)) {
    return { ok: false, error: issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Blog action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const postSchema = z.object({
  title: z.string().trim().min(1, "Give the article a title.").max(240),
  slug: z.string().trim().max(220).optional().nullable(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  body: z.string().max(200_000).default(""),
  bannerImageUrl: z.string().trim().max(2000).optional().nullable(),
  bannerImageAlt: z.string().trim().max(300).optional().nullable(),
  metaTitle: z.string().trim().max(240).optional().nullable(),
  metaDescription: z.string().trim().max(400).optional().nullable(),
  focusKeyword: z.string().trim().max(160).optional().nullable(),
  schemaJson: z.string().max(20_000).optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "TRASHED"]).optional(),
  /** Datetime-local value from the editor, or empty for "not dated yet". */
  publishedAt: z.string().trim().max(40).optional().nullable(),
});

export type BlogFormInput = z.input<typeof postSchema>;

export async function createBlogPostAction(
  input: BlogFormInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const parsed = postSchema.parse(input);
    const context = await requireAdmin();
    const post = await createBlogPost(parsed, context);

    revalidatePath("/blog");
    return { ok: true, data: post };
  } catch (error) {
    return fail(error);
  }
}

export async function updateBlogPostAction(
  id: string,
  input: BlogFormInput,
): Promise<ActionResult<{ slug: string }>> {
  try {
    const parsed = postSchema.parse(input);
    const context = await requireAdmin();
    const result = await updateBlogPost(id, parsed, context);

    revalidatePath("/blog");
    revalidatePath(`/blog/${id}`);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function setBlogStatusAction(
  id: string,
  status: BlogStatus,
): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await setBlogStatus(id, status, context);
    revalidatePath("/blog");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
