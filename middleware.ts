import { NextRequest, NextResponse } from "next/server";

const SITE_ORIGIN = "https://lettingpartners.co.uk";
const PORTAL_PREFIXES = [
  "/admin",
  "/api",
  "/call-records",
  "/daily-reports",
  "/dashboard",
  "/dialer",
  "/landlords",
  "/login",
  "/messages",
  "/notes",
  "/portal",
  "/potential-landlords",
  "/potential-tenants",
  "/profile",
  "/sales",
  "/templates",
  "/tenants",
  "/verify-otp",
];

function isPortalPath(pathname: string) {
  return PORTAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (isPortalPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(`${pathname}${search}`, SITE_ORIGIN), 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
