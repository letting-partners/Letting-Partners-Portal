import { NextResponse, type NextRequest } from "next/server";
import { jsonError, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { getWebsiteProperty } from "@/services/website";

/**
 * GET /api/website/properties/:id
 *
 * `id` is the public slug, and the internal uuid is also accepted so older
 * links keep working.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const { id } = await params;

  try {
    const property = await getWebsiteProperty(id);

    if (!property) {
      return withCors(jsonError("Property not found.", 404), request.headers.get("origin"));
    }

    const response = NextResponse.json({ ok: true, property });
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return withCors(response, request.headers.get("origin"));
  } catch (error) {
    console.error("Website property detail endpoint failed:", error);
    return withCors(jsonError("Unable to load property.", 500), request.headers.get("origin"));
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
}
