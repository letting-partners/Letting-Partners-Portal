import { NextRequest, NextResponse } from "next/server";
import { getPublicWebsiteProperty } from "@/lib/website-properties";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const property = await getPublicWebsiteProperty(params.id);
    if (!property) {
      return NextResponse.json({ ok: false, error: "Property not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, property });
  } catch (error) {
    console.error("Public website property detail API error:", error);
    return NextResponse.json({ ok: false, error: "Unable to load property." }, { status: 500 });
  }
}
