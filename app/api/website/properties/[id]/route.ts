import { NextRequest } from "next/server";
import {
  validateWebsiteApiRequest,
  websiteJsonResponse,
  websiteOptionsResponse,
} from "@/lib/website-cors";
import { getPublicWebsiteProperty } from "@/lib/website-properties";

export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return websiteOptionsResponse(request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const unauthorized = validateWebsiteApiRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const property = await getPublicWebsiteProperty(params.id);
    if (!property) {
      return websiteJsonResponse(
        request,
        { ok: false, error: "Property not found." },
        { status: 404 },
      );
    }

    return websiteJsonResponse(request, { ok: true, property });
  } catch (error) {
    console.error("Public website property detail API error:", error);
    return websiteJsonResponse(
      request,
      { ok: false, error: "Unable to load property." },
      { status: 500 },
    );
  }
}
