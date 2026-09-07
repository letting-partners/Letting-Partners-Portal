import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Cryptographic helpers for authentication. Session tokens and OTP codes are
 * only ever stored as hashes, so a database leak cannot be replayed as a login.
 */

/** URL-safe random token used as the raw session secret held in the cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 of a high-entropy token. A slow KDF buys nothing here because the
 * input is already 256 bits of randomness, and this runs on every request.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Six digit numeric OTP, uniformly distributed. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * OTP codes are low entropy, so the hash is salted with AUTH_SECRET. Without
 * the server secret a stolen code hash cannot be brute forced offline.
 */
export function hashOtp(code: string, email: string, secret: string): string {
  return createHash("sha256")
    .update(`${secret}:${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}

/** Comparison that does not leak how many characters matched. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Opaque token identifying a website visitor across chat sessions. */
export function generateVisitorToken(): string {
  return randomBytes(24).toString("base64url");
}
