import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { issueAuthSessionCookie, loginWithPassword } from "@/server/auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.enum(["agent", "admin"]).optional().default("agent"),
});

export async function POST(request: Request) {
  let payload: z.infer<typeof loginSchema>;

  try {
    payload = loginSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const expectedRole = payload.portal === "admin" ? UserRole.ADMIN : UserRole.AGENT;
  let result: Awaited<ReturnType<typeof loginWithPassword>>;
  try {
    result = await loginWithPassword({
      email: payload.email,
      password: payload.password,
      expectedRole,
    });
  } catch (err) {
    console.error("[login] database error:", err);
    return NextResponse.json({ error: "DB_ERROR", detail: String(err) }, { status: 500 });
  }

  if (!result.ok) {
    if (result.code === "ROLE_MISMATCH") {
      if (result.actualRole === UserRole.ADMIN) {
        return NextResponse.json({ error: "ADMIN_LOGIN_REQUIRED" }, { status: 403 });
      }

      return NextResponse.json({ error: "AGENT_LOGIN_REQUIRED" }, { status: 403 });
    }

    if (result.code === "INVALID_CREDENTIALS") {
      return NextResponse.json({ error: result.code }, { status: 401 });
    }

    if (result.code === "OTP_SEND_RATE_LIMIT") {
      return NextResponse.json(
        {
          error: result.code,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: result.code }, { status: 500 });
  }

  if (!result.requiresOtp) {
    await issueAuthSessionCookie({
      userId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    });

    const redirectTo = result.user.role === UserRole.ADMIN ? "/admin" : "/dashboard";
    return NextResponse.json({
      ok: true,
      requiresOtp: false,
      message: "Signed in successfully.",
      redirectTo,
    });
  }

  const verifyPath =
    expectedRole === UserRole.ADMIN
      ? `/admin/verify-otp?email=${encodeURIComponent(payload.email.trim().toLowerCase())}`
      : `/verify-otp?email=${encodeURIComponent(payload.email.trim().toLowerCase())}`;

  return NextResponse.json({
    ok: true,
    requiresOtp: true,
    message: "OTP sent",
    redirectTo: verifyPath,
  });
}
