import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * A cheap redirect for visitors with no session cookie, so an unauthenticated
 * request never pays for rendering an app page.
 *
 * This is a convenience only. Real authorisation happens in the layout, the
 * route handlers and the server actions - a cookie being present proves
 * nothing about whether it is valid.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    // The website and the public chat widget authenticate by API key instead.
    pathname.startsWith("/api/website") ||
    pathname.startsWith("/api/public")
  );
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.svg|lp-logo.webp).*)",
  ],
};
