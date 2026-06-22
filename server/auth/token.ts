import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { env } from "@/lib/env";

type SessionTokenHeader = {
  alg: "HS256";
  typ: "JWT";
};

export type SessionTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
};

type CreateSessionTokenInput = {
  userId: string;
  email: string;
  role: UserRole;
};

const HEADER: SessionTokenHeader = {
  alg: "HS256",
  typ: "JWT",
};

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signHmac(value: string): string {
  return createHmac("sha256", env.AUTH_SESSION_SECRET).update(value).digest("base64url");
}

function isValidPayload(payload: unknown): payload is SessionTokenPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<SessionTokenPayload>;
  return (
    typeof candidate.sub === "string" &&
    typeof candidate.email === "string" &&
    (candidate.role === "ADMIN" || candidate.role === "AGENT") &&
    typeof candidate.iat === "number" &&
    typeof candidate.exp === "number"
  );
}

export function createSessionToken(input: CreateSessionTokenInput): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + env.AUTH_SESSION_TTL_HOURS * 60 * 60;

  const payload: SessionTokenPayload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    iat: issuedAt,
    exp: expiresAt,
  };

  const headerPart = encodeBase64Url(JSON.stringify(HEADER));
  const payloadPart = encodeBase64Url(JSON.stringify(payload));
  const signaturePart = signHmac(`${headerPart}.${payloadPart}`);

  return `${headerPart}.${payloadPart}.${signaturePart}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const expectedSignature = signHmac(`${headerPart}.${payloadPart}`);
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
  const signatureBuffer = Buffer.from(signaturePart, "utf8");

  if (expectedSignatureBuffer.length !== signatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedSignatureBuffer, signatureBuffer)) {
    return null;
  }

  try {
    const headerJson = decodeBase64Url(headerPart);
    const header = JSON.parse(headerJson) as Partial<SessionTokenHeader>;
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    const payloadJson = decodeBase64Url(payloadPart);
    const payload = JSON.parse(payloadJson);

    if (!isValidPayload(payload)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
