import { NextResponse, type NextRequest } from "next/server";
import { jsonError, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { getPublicBlogPost } from "@/services/blog";

/** GET /api/website/blog/[slug] - one published article. */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const origin = request.headers.get("origin");

  try {
    const { slug } = await params;
    const post = await getPublicBlogPost(slug);
    if (!post) return withCors(jsonError("Article not found.", 404), origin);

    const response = NextResponse.json({ ok: true, post });
    response.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return withCors(response, origin);
  } catch (error) {
    console.error("Website blog detail endpoint failed:", error);
    return withCors(jsonError("Unable to load the article.", 500), origin);
  }
}
