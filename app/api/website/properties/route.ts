import { NextResponse, type NextRequest } from "next/server";
import { jsonError, parseIntParam, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { listWebsiteProperties } from "@/services/website";
import { poundsToPence } from "@/lib/money";

/**
 * GET /api/website/properties
 *
 * The endpoint the public Letting Partners website already calls. The response
 * shape matches what the site expects today, so publishing from the portal
 * makes listings appear without any change to the website code.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const params = request.nextUrl.searchParams;

  try {
    const properties = await listWebsiteProperties({
      limit: parseIntParam(params.get("limit"), 24),
      offset: parseIntParam(params.get("offset"), 0),
      area: params.get("area") ?? undefined,
      outcode: params.get("outcode") ?? undefined,
      type: params.get("type") === "SHARED" ? "SHARED" : params.get("type") === "FULL" ? "FULL" : undefined,
      bedrooms: params.get("bedrooms") ? parseIntParam(params.get("bedrooms"), 0) : undefined,
      minRentPence: poundsToPence(params.get("minRent")) ?? undefined,
      maxRentPence: poundsToPence(params.get("maxRent")) ?? undefined,
      search: params.get("search") ?? undefined,
      featured: params.get("featured") === "1" || params.get("featured") === "true",
    });

    const response = NextResponse.json({ ok: true, properties });
    response.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return withCors(response, request.headers.get("origin"));
  } catch (error) {
    console.error("Website properties endpoint failed:", error);
    return withCors(jsonError("Unable to load properties.", 500), request.headers.get("origin"));
  }
}

export async function OPTIONS(request: NextRequest) {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
}
