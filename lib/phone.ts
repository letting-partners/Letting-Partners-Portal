/**
 * Centralised UK phone handling. Every lookup, landlord, tenant and call in the
 * system derives its identity from `normalizeUKPhone`, so this file is the only
 * place that is allowed to decide what "the same number" means.
 *
 * The rule: take the last 10 significant digits. That makes all of these equal:
 *
 *   +44 7911 123456
 *   07911 123456
 *   0044 7911 123456
 *   (07911) 123-456
 *   7911123456
 *
 *   -> 7911123456
 */

export const NORMALIZED_PHONE_LENGTH = 10;

export type PhoneNormalizationResult =
  | { ok: true; normalized: string; original: string }
  | { ok: false; reason: PhoneNormalizationError; original: string };

export type PhoneNormalizationError = "EMPTY" | "TOO_SHORT" | "TOO_LONG" | "INVALID_PREFIX";

/** Valid first digits of a UK national (significant) number. */
const VALID_LEADING_DIGITS = new Set(["1", "2", "3", "5", "7", "8", "9"]);

function digitsOnly(input: string): string {
  return input.replace(/\D+/g, "");
}

/**
 * Reduce any UK phone input to its 10 significant digits.
 * Returns null when the input cannot be a UK number.
 */
export function normalizeUKPhone(input: string | null | undefined): string | null {
  const result = normalizeUKPhoneDetailed(input);
  return result.ok ? result.normalized : null;
}

export function normalizeUKPhoneDetailed(
  input: string | null | undefined,
): PhoneNormalizationResult {
  const original = (input ?? "").trim();
  if (!original) return { ok: false, reason: "EMPTY", original };

  let digits = digitsOnly(original);
  if (!digits) return { ok: false, reason: "EMPTY", original };

  // Strip international prefixes before counting, so 0044... and +44... agree.
  if (digits.startsWith("0044")) digits = digits.slice(4);
  else if (digits.startsWith("44") && digits.length > NORMALIZED_PHONE_LENGTH) digits = digits.slice(2);

  // Strip the national trunk prefix.
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  if (digits.length < NORMALIZED_PHONE_LENGTH) return { ok: false, reason: "TOO_SHORT", original };
  if (digits.length > 13) return { ok: false, reason: "TOO_LONG", original };

  const normalized = digits.slice(-NORMALIZED_PHONE_LENGTH);
  const leading = normalized[0] ?? "";
  if (!VALID_LEADING_DIGITS.has(leading)) {
    return { ok: false, reason: "INVALID_PREFIX", original };
  }

  return { ok: true, normalized, original };
}

export function isValidUKPhone(input: string | null | undefined): boolean {
  return normalizeUKPhone(input) !== null;
}

/**
 * Present a normalized number the way a UK user expects to read it.
 * Mobiles (07...) group 5+6, London/geographic 02x group 3+4+4, everything
 * else falls back to a 4+6 grouping.
 */
export function formatUKPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  const digits = digitsOnly(normalized);
  if (digits.length !== NORMALIZED_PHONE_LENGTH) return normalized;

  if (digits.startsWith("7")) {
    return `0${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  if (digits.startsWith("2")) {
    return `0${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** E.164 form, used for tel: links and any future telephony integration. */
export function toE164(normalized: string | null | undefined): string {
  if (!normalized) return "";
  const digits = digitsOnly(normalized);
  if (digits.length !== NORMALIZED_PHONE_LENGTH) return "";
  return `+44${digits}`;
}

/** Best-effort display of whatever the user originally typed. */
export function displayPhone(original: string | null, normalized: string | null): string {
  if (original && original.trim()) return original.trim();
  return formatUKPhone(normalized);
}

export const PHONE_ERROR_MESSAGES: Record<PhoneNormalizationError, string> = {
  EMPTY: "Enter a phone number.",
  TOO_SHORT: "That is not enough digits for a UK phone number.",
  TOO_LONG: "That is too many digits for a UK phone number.",
  INVALID_PREFIX: "That does not look like a UK phone number.",
};
