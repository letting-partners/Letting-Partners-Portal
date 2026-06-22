type NormalizePhoneResult =
  | { ok: true; phoneLast10: string; phoneE164: string }
  | { ok: false; message: string };

function stripFormatting(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

function stripCountryPrefix(value: string): string {
  if (value.startsWith("+44")) {
    return value.slice(3);
  }

  if (value.startsWith("0044")) {
    return value.slice(4);
  }

  if (value.startsWith("44") && value.length > 10) {
    return value.slice(2);
  }

  return value;
}

export function normalizeUkPhone(input: string): NormalizePhoneResult {
  const raw = stripFormatting(input.trim());
  if (!raw) {
    return { ok: false, message: "Phone number is required." };
  }

  const withoutPrefix = stripCountryPrefix(raw);
  const digitsOnly = withoutPrefix.replace(/\D/g, "");
  const withoutLocalZero =
    digitsOnly.startsWith("0") && digitsOnly.length > 10 ? digitsOnly.slice(1) : digitsOnly;

  if (withoutLocalZero.length < 10) {
    return {
      ok: false,
      message: "Phone number must contain at least 10 digits after UK normalization.",
    };
  }

  const phoneLast10 = withoutLocalZero.slice(-10);
  if (!/^\d{10}$/.test(phoneLast10)) {
    return {
      ok: false,
      message: "Phone number normalization failed. Provide a valid UK number.",
    };
  }

  return {
    ok: true,
    phoneLast10,
    phoneE164: `+44${phoneLast10}`,
  };
}

