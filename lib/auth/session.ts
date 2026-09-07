import "server-only";
import { cache } from "react";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { generateSessionToken, hashToken } from "./crypto";

export const SESSION_COOKIE = "lp_portal_session";

/**
 * The signed-in user, plus the assignment context every permission check needs.
 * Loaded once per request via React `cache`, so a page that checks permissions
 * in ten components still issues one query.
 */
export type SessionUser = Pick<
  User,
  | "id"
  | "email"
  | "fullName"
  | "role"
  | "status"
  | "avatarUrl"
  | "jobTitle"
  | "phone"
  | "assignedAgentId"
  | "themePreference"
  | "notificationPreferences"
>;

async function clientIp(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headerList.get("x-real-ip");
}

async function clientUserAgent(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get("user-agent");
}

/** Issues a session and sets the cookie. Called only after OTP verification. */
export async function createSession(userId: string, remember: boolean): Promise<void> {
  const env = serverEnv();
  const token = generateSessionToken();
  const ttlMs = remember
    ? env.SESSION_REMEMBER_TTL_DAYS * 24 * 60 * 60 * 1000
    : env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    ip: await clientIp(),
    userAgent: await clientUserAgent(),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolve the current user from the session cookie.
 * Returns null for missing, expired, revoked or deactivated accounts.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
      phone: users.phone,
      assignedAgentId: users.assignedAgentId,
      themePreference: users.themePreference,
      notificationPreferences: users.notificationPreferences,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
        isNull(users.deletedAt),
        eq(users.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
});

/** Revokes the current session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Signs the user out of every device. Used on deactivation and by the user. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export { clientIp, clientUserAgent };
