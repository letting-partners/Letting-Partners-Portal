import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const HASH_PREFIX = "scrypt";
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password is required");
  }

  const salt = randomBytes(SALT_BYTES).toString("base64url");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_PREFIX}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) {
    return false;
  }

  const [prefix, salt, expectedHash] = passwordHash.split("$");
  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  const expectedBuffer = Buffer.from(expectedHash, "base64url");

  if (expectedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, derivedKey);
}
