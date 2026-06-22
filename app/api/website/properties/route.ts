import { NextRequest } from "next/server";
import {
  validateWebsiteApiRequest,
  websiteJsonResponse,
  websiteOptionsResponse,
} from "@/lib/website-cors";
import { getPublicWebsiteProperties } from "@/lib/website-properties";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return websiteOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const unauthorized = validateWebsiteApiRequest(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const area = searchParams.get("area") ?? undefined;

  try {
    const properties = await getPublicWebsiteProperties({ limit, area });
    return websiteJsonResponse(request, { ok: true, properties, total: properties.length, limit, area: area ?? "" });
  } catch (error) {
    console.error("Public website properties API error:", error);
    return websiteJsonResponse(
      request,
      { ok: false, error: "Unable to load properties." },
      { status: 500 },
    );
  }
}
