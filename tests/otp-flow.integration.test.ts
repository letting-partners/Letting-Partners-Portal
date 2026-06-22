import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ensureTestEnv, hasPostgresTestDatabase, usePostgresTestDatabase } from "./helpers/test-env";

ensureTestEnv();
usePostgresTestDatabase();

const hasPg = hasPostgresTestDatabase();

test("postgres integration: OTP flow works and rate limits apply", { skip: !hasPg }, async () => {
  const [{ db }, authPassword, authOtp, authService] = await Promise.all([
    import("../server/db"),
    import("../server/auth/password"),
    import("../server/auth/otp"),
    import("../server/auth/service"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const email = `otp-${suffix}@example.com`;
  const plainPassword = "Passw0rd!123";

  const passwordHash = await authPassword.hashPassword(plainPassword);
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      role: "AGENT",
      agentDisplayName: `OTP Agent ${suffix}`,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  try {
    const loginOne = await authService.loginWithPassword({
      email: user.email,
      password: plainPassword,
    });
    assert.equal(loginOne.ok, true);
    if (loginOne.ok) {
      assert.equal(loginOne.requiresOtp, true);
    }

    const loginTwo = await authService.loginWithPassword({
      email: user.email,
      password: plainPassword,
    });
    assert.equal(loginTwo.ok, true);
    if (loginTwo.ok) {
      assert.equal(loginTwo.requiresOtp, true);
    }

    const loginThree = await authService.loginWithPassword({
      email: user.email,
      password: plainPassword,
    });
    assert.equal(loginThree.ok, false);
    if (!loginThree.ok) {
      assert.equal(loginThree.code, "OTP_SEND_RATE_LIMIT");
    }

    const activeOtp = await db.oTPCode.findFirst({
      where: {
        userId: user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    assert.ok(activeOtp);

    const knownCode = "123456";
    await db.oTPCode.update({
      where: { id: activeOtp!.id },
      data: {
        codeHash: authOtp.hashOtpCode(user.id, knownCode),
      },
    });

    const verifySuccess = await authService.verifyOtpForLogin({
      email: user.email,
      otpCode: knownCode,
    });
    assert.equal(verifySuccess.ok, true);

    const loginAfterRecentActivity = await authService.loginWithPassword({
      email: user.email,
      password: plainPassword,
    });
    assert.equal(loginAfterRecentActivity.ok, true);
    if (loginAfterRecentActivity.ok) {
      assert.equal(loginAfterRecentActivity.requiresOtp, false);
    }

    const limiterCode = "654321";
    await db.oTPCode.create({
      data: {
        userId: user.id,
        codeHash: authOtp.hashOtpCode(user.id, limiterCode),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    const verifyWrongOne = await authService.verifyOtpForLogin({
      email: user.email,
      otpCode: "000000",
    });
    assert.equal(verifyWrongOne.ok, false);
    if (!verifyWrongOne.ok) {
      assert.equal(verifyWrongOne.code, "OTP_INVALID");
    }

    const verifyWrongTwo = await authService.verifyOtpForLogin({
      email: user.email,
      otpCode: "000000",
    });
    assert.equal(verifyWrongTwo.ok, false);
    if (!verifyWrongTwo.ok) {
      assert.equal(verifyWrongTwo.code, "OTP_INVALID");
    }

    const verifyRateLimited = await authService.verifyOtpForLogin({
      email: user.email,
      otpCode: "000000",
    });
    assert.equal(verifyRateLimited.ok, false);
    if (!verifyRateLimited.ok) {
      assert.equal(verifyRateLimited.code, "OTP_VERIFY_RATE_LIMIT");
    }
  } finally {
    await db.user.delete({
      where: { id: user.id },
    });
  }
});
