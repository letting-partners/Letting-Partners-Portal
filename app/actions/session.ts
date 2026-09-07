"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { isThemePreference, THEME_COOKIE, type ThemePreference } from "@/lib/theme";
import { recordAudit } from "@/services/audit";

/** Session-level actions available from the app shell. */

export async function signOutAction(): Promise<void> {
  const user = await getSessionUser();

  if (user) {
    await recordAudit({
      user,
      action: "LOGOUT",
      entityType: "Session",
      entityId: user.id,
      entityLabel: user.email,
    });
  }

  await destroySession();
  redirect("/login");
}

/**
 * Theme lives in two places on purpose: a cookie so the very first paint is
 * correct, and the user record so the choice follows them to another device.
 */
export async function setThemeAction(preference: string): Promise<void> {
  if (!isThemePreference(preference)) return;

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, preference, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  const user = await getSessionUser();
  if (user) {
    await db
      .update(users)
      .set({ themePreference: preference as ThemePreference, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }
}
