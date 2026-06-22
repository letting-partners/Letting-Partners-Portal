import type { UserRole } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthSession, getAuthSessionFromRequest, type AuthSession } from "./session";

type ApiAuthGuardResult =
  | { ok: true; session: AuthSession }
  | { ok: false; response: NextResponse };

function hasAllowedRole(session: AuthSession, allowedRoles: UserRole[] | undefined): boolean {
  return !allowedRoles || allowedRoles.length === 0 || allowedRoles.includes(session.role);
}

export async function requirePageSession(allowedRoles?: UserRole[]): Promise<AuthSession | null> {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  if (!hasAllowedRole(session, allowedRoles)) {
    return null;
  }

  return session;
}

export function requireApiSession(
  request: NextRequest,
  allowedRoles?: UserRole[],
): ApiAuthGuardResult {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  if (!hasAllowedRole(session, allowedRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    session,
  };
}
