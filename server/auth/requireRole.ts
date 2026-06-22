import { NextResponse } from "next/server";
import type { RequestUser } from "./requireUser";

type RequireRoleResult = { ok: true } | { ok: false; response: NextResponse };

export function requireRole(
  user: RequestUser,
  allowedRoles: Array<"ADMIN" | "AGENT">,
): RequireRoleResult {
  if (allowedRoles.includes(user.role)) {
    return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
  };
}
