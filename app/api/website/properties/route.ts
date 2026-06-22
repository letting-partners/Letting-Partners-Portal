import { NextRequest, NextResponse } from "next/server";
import { getPublicWebsiteProperties } from "@/lib/website-properties";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const area = searchParams.get("area") ?? undefined;

  try {
    const properties = await getPublicWebsiteProperties({ limit, area });
    return NextResponse.json({ ok: true, properties, total: properties.length, limit, area: area ?? "" });
  } catch (error) {
    console.error("Public website properties API error:", error);
    return NextResponse.json({ ok: false, error: "Unable to load properties." }, { status: 500 });
  }
}
