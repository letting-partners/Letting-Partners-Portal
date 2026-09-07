import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "./env";

/**
 * Shared-secret authentication for the public website integration.
 *
 * The website sends `x-website-api-key`, matching the value it already has in
 * its own environment. This guards the endpoint against casual scraping; it is
 * not a substitute for the whitelist in `services/website.ts`, which is what
 * actually keeps private fields out of the response.
 */

const HEADER = "x-website-api-key";

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function verifyWebsiteApiKey(request: NextRequest): NextResponse | null {
  const provided = request.headers.get(HEADER) ?? request.nextUrl.searchParams.get("apiKey");

  if (!provided) {
    return jsonError("Missing API key.", 401);
  }

  let expected: string;
  try {
    expected = serverEnv().WEBSITE_API_KEY;
  } catch (error) {
    console.error("Website API key is not configured:", error);
    return jsonError("The API is not configured.", 500);
  }

  if (!constantTimeEquals(provided, expected)) {
    return jsonError("Invalid API key.", 401);
  }

  return null;
}

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * CORS for the public website origin. Kept to the one configured origin rather
 * than a wildcard, so the key cannot be used from an arbitrary page.
 */
export function withCors(response: NextResponse, origin: string | null): NextResponse {
  const allowed = process.env.NEXT_PUBLIC_SITE_URL;
  if (allowed && origin && origin === allowed.replace(/\/$/, "")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
    response.headers.set("Access-Control-Allow-Headers", HEADER);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  return response;
}

export function parseIntParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
