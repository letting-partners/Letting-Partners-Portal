import "server-only";
import type { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { createSessionToken, verifySessionToken } from "./token";

export type AuthSession = {
  userId: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
};

type CreateAuthSessionInput = {
  userId: string;
  email: string;
  role: UserRole;
};

type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

function getSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: env.AUTH_SESSION_TTL_HOURS * 60 * 60,
  };
}

export function parseSessionToken(token: string | undefined): AuthSession | null {
  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    expiresAt: new Date(payload.exp * 1000),
  };
}

export function getAuthSessionFromRequest(request: NextRequest): AuthSession | null {
  const token = request.cookies.get(env.AUTH_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export async function issueAuthSessionCookie(input: CreateAuthSessionInput): Promise<void> {
  const token = createSessionToken(input);
  cookies().set(env.AUTH_COOKIE_NAME, token, getSessionCookieOptions());
}

export async function clearAuthSessionCookie(): Promise<void> {
  cookies().set(env.AUTH_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const token = cookies().get(env.AUTH_COOKIE_NAME)?.value;
  return parseSessionToken(token);
}

export async function requireAuthSession(): Promise<AuthSession | null> {
  return getAuthSession();
}
