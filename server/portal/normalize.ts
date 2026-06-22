import { normalizeUkPhone } from "@/server/phone";

export type NormalizedPhoneResult =
  | { ok: true; phoneLast10: string; phoneE164: string }
  | { ok: false; message: string };

function capitalizeWord(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.slice(0, 1).toUpperCase()}${value.slice(1).toLowerCase()}`;
}

export function normalizePostcode(input: string): string {
  return input.trim().replace(/\s+/g, " ").toUpperCase();
}

export function normalizePhone(input: string): NormalizedPhoneResult {
  return normalizeUkPhone(input) as NormalizedPhoneResult;
}

export function normalizeNamePart(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "";
  }

  return cleaned
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((hyphenPart) =>
          hyphenPart
            .split("'")
            .map((apostrophePart) => capitalizeWord(apostrophePart))
            .join("'"),
        )
        .join("-"),
    )
    .join(" ");
}

export function calculateRentPerWeek(
  value: string | number | bigint | { toString(): string } | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value.toString());
  if (!Number.isFinite(amount)) {
    return null;
  }

  return (amount * 12 / 52).toFixed(2);
}

export function generatePropertyReference(prefix = "PROP"): string {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${datePart}-${timePart}-${randomPart}`;
}