/**
 * UK postcode handling. Postcodes are stored uppercased with a single space
 * before the inward code, and the outward code is indexed separately because
 * area search and the public partial address both work on it.
 */

const UK_POSTCODE_PATTERN =
  /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;

export type PostcodeParts = {
  /** "M14" - the part shown publicly. */
  outcode: string;
  /** "5AB" - never exposed on the public website. */
  incode: string;
  /** "M14 5AB" */
  formatted: string;
};

export function parsePostcode(input: string | null | undefined): PostcodeParts | null {
  const raw = (input ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return null;

  const match = UK_POSTCODE_PATTERN.exec(raw.replace(/\s+/g, ""));
  if (!match) return null;

  const outcode = match[1].toUpperCase();
  const incode = match[2].toUpperCase();
  return { outcode, incode, formatted: `${outcode} ${incode}` };
}

export function isValidPostcode(input: string | null | undefined): boolean {
  return parsePostcode(input) !== null;
}

/** "m14 5ab" -> "M14 5AB". Returns the trimmed input when unparseable. */
export function formatPostcode(input: string | null | undefined): string {
  const parts = parsePostcode(input);
  return parts ? parts.formatted : (input ?? "").trim().toUpperCase();
}

export function getOutcode(input: string | null | undefined): string | null {
  return parsePostcode(input)?.outcode ?? null;
}

/**
 * The postcode area letters ("M" from "M14"), used to widen a cross-sell
 * search from a single outcode to the surrounding district.
 */
export function getPostcodeArea(input: string | null | undefined): string | null {
  const outcode = getOutcode(input);
  if (!outcode) return null;
  const match = /^[A-Z]{1,2}/.exec(outcode);
  return match ? match[0] : null;
}

/** Split a stored comma separated outcode preference list. */
export function parseOutcodeList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}
