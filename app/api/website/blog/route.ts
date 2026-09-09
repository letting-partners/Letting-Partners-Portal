import { NextResponse, type NextRequest } from "next/server";
import { jsonError, parseIntParam, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { listPublicBlogPosts } from "@/services/blog";

/**
 * GET /api/website/blog
 *
 * Published articles for the website, newest first. An article dated in the
 * future is not returned until that date passes, which is how scheduling works
 * without anything having to run on a timer.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const params = request.nextUrl.searchParams;

  try {
    const posts = await listPublicBlogPosts(
      parseIntParam(params.get("limit"), 24),
      parseIntParam(params.get("offset"), 0),
    );

    const response = NextResponse.json({ ok: true, posts });
    response.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return withCors(response, request.headers.get("origin"));
  } catch (error) {
    console.error("Website blog endpoint failed:", error);
    return withCors(jsonError("Unable to load articles.", 500), request.headers.get("origin"));
  }
}
