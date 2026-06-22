import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { issueAuthSessionCookie, verifyOtpForLogin } from "@/server/auth";

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/),
  portal: z.enum(["agent", "admin"]).optional().default("agent"),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof verifyOtpSchema>;

  try {
    payload = verifyOtpSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const expectedRole = payload.portal === "admin" ? UserRole.ADMIN : UserRole.AGENT;
  const result = await verifyOtpForLogin({
    email: payload.email,
    otpCode: payload.otpCode,
    expectedRole,
  });

  if (!result.ok) {
    if (result.code === "ROLE_MISMATCH") {
      if (result.actualRole === UserRole.ADMIN) {
        return NextResponse.json({ error: "ADMIN_LOGIN_REQUIRED" }, { status: 403 });
      }

      return NextResponse.json({ error: "AGENT_LOGIN_REQUIRED" }, { status: 403 });
    }

    if (result.code === "OTP_VERIFY_RATE_LIMIT") {
      return NextResponse.json(
        {
          error: result.code,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    if (result.code === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: result.code }, { status: 401 });
    }

    if (result.code === "OTP_INVALID" || result.code === "OTP_ATTEMPTS_EXCEEDED") {
      return NextResponse.json(
        {
          error: result.code,
          attemptsRemaining: result.attemptsRemaining,
        },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: result.code }, { status: 400 });
  }

  await issueAuthSessionCookie({
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
  });

  const redirectTo = result.user.role === UserRole.ADMIN ? "/admin" : "/dashboard";

  return NextResponse.json({ ok: true, redirectTo });
}
