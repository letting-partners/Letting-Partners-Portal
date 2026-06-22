import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

export function GET() {
  const file = readFileSync(join(process.cwd(), "public", "favicon.svg"));
  return new NextResponse(file, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
