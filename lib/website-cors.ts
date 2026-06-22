import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://lettingpartners.co.uk",
  "https://www.lettingpartners.co.uk",
];

function allowedOrigins() {
  return (
    process.env.WEBSITE_ALLOWED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? DEFAULT_ALLOWED_ORIGINS
  );
}

export function websiteCorsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, x-website-api-key",
    "Access-Control-Max-Age": "86400",
  });

  if (!origin) return headers;

  const origins = allowedOrigins();
  if (origins.includes("*")) {
    headers.set("Access-Control-Allow-Origin", "*");
    return headers;
  }

  if (origins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return headers;
}

export function websiteOptionsResponse(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: websiteCorsHeaders(request),
  });
}

export function websiteJsonResponse<T>(
  request: NextRequest,
  body: T,
  init: ResponseInit = {},
) {
  const headers = websiteCorsHeaders(request);

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function validateWebsiteApiRequest(request: NextRequest) {
  const expectedKey = process.env.WEBSITE_API_KEY?.trim();
  if (!expectedKey) return null;

  const providedKey = request.headers.get("x-website-api-key")?.trim();
  if (providedKey === expectedKey) return null;

  return websiteJsonResponse(
    request,
    { ok: false, error: "Unauthorized website API request." },
    { status: 401 },
  );
}
