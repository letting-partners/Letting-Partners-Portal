export function normalizePostcode(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";

  const collapsed = trimmed.replace(/\s+/g, "");
  if (collapsed.length <= 5) {
    return collapsed;
  }

  const outward = collapsed.slice(0, -3);
  const inward = collapsed.slice(-3);
  return `${outward} ${inward}`;
}

export function normalizePhoneNo(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("+")) {
    return `+${cleaned.slice(1).replace(/\+/g, "")}`;
  }

  return cleaned.replace(/\+/g, "");
}

export function calculateRentPerWeek(rentPerMonth: number | string | null | undefined): number | null {
  if (rentPerMonth == null || rentPerMonth === "") {
    return null;
  }

  const numeric = typeof rentPerMonth === "string" ? Number(rentPerMonth) : rentPerMonth;
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(((numeric * 12) / 52).toFixed(2));
}