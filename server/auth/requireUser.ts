import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getAuthSessionFromRequest } from "./session";

export type RequestUser = {
  id: string;
  email: string;
  role: "ADMIN" | "AGENT";
  isActive: boolean;
  agentDisplayName: string;
};

type RequireUserResult = { ok: true; user: RequestUser } | { ok: false; response: NextResponse };

export async function requireUser(request: NextRequest): Promise<RequireUserResult> {
  const session = getAuthSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      agentDisplayName: true,
    },
  });

  if (!user || !user.isActive) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    user,
  };
}
