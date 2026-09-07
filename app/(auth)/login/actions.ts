"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requestOtp, verifyOtp } from "@/lib/auth/otp";
import { clientIp, createSession } from "@/lib/auth/session";
import { recordAudit } from "@/services/audit";

/**
 * Two-step OTP sign-in.
 *
 * Neither step ever reveals whether an email address has an account: the
 * request step always reports success, and only the verify step can fail, by
 * which point the caller has had to produce a code that was emailed.
 */

export type RequestCodeState = {
  status: "idle" | "sent" | "error";
  email: string;
  message: string | null;
};

const emailSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").max(254).email("Enter a valid email address."),
});

export async function requestCodeAction(
  _previous: RequestCodeState,
  formData: FormData,
): Promise<RequestCodeState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      status: "error",
      email: String(formData.get("email") ?? ""),
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const result = await requestOtp(email, await clientIp());

  if (!result.ok) {
    return { status: "error", email, message: result.error };
  }

  return {
    status: "sent",
    email,
    message: null,
  };
}

export type VerifyCodeState = {
  status: "idle" | "error";
  message: string | null;
};

const verifySchema = z.object({
  email: z.string().trim().min(1).max(254),
  code: z
    .string()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 6, "Enter the 6 digit code."),
  remember: z.string().nullable().optional(),
});

export async function verifyCodeAction(
  _previous: VerifyCodeState,
  formData: FormData,
): Promise<VerifyCodeState> {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    remember: formData.get("remember"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter the 6 digit code." };
  }

  const { email, code, remember } = parsed.data;
  const result = await verifyOtp(email, code);

  if (!result.ok) {
    await recordAudit({
      user: null,
      action: "LOGIN_FAILED",
      entityType: "Session",
      entityLabel: email,
      ip: await clientIp(),
      metadata: { reason: result.error },
    });
    return { status: "error", message: result.error };
  }

  await createSession(result.userId, remember === "on");

  const account = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(eq(users.id, result.userId))
    .limit(1);

  const user = account[0];
  if (user) {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await recordAudit({
      user,
      action: "LOGIN",
      entityType: "Session",
      entityId: user.id,
      entityLabel: user.email,
      ip: await clientIp(),
    });
  }

  // redirect throws, so nothing after this line runs.
  redirect("/dashboard");
}
