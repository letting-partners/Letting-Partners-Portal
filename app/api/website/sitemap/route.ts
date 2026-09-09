import { NextResponse, type NextRequest } from "next/server";
import { jsonError, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { listWebsiteSlugs } from "@/services/website";

/**
 * GET /api/website/sitemap
 *
 * Every published listing with the date it last changed, for the website's
 * sitemap. Separate from /properties because a sitemap wants all of them and
 * none of the detail - no images, no rent, no room breakdown - and because
 * lastModified has to be the real modification date rather than the time the
 * sitemap happened to be generated.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  try {
    const entries = await listWebsiteSlugs();

    const response = NextResponse.json({ ok: true, entries });
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return withCors(response, request.headers.get("origin"));
  } catch (error) {
    console.error("Website sitemap endpoint failed:", error);
    return withCors(jsonError("Unable to load the sitemap.", 500), request.headers.get("origin"));
  }
}
