import { NextResponse, type NextRequest } from "next/server";
import { requireAccess } from "@/services/permissions";
import { parsePostcode } from "@/lib/postcode";
import { getAddressApiKey } from "@/services/settings";
import type { AddressSuggestion } from "@/lib/address";

/**
 * GET /api/address?postcode=HA1+1AA
 *
 * Postcode lookup for the property wizard, proxied so the key stays on the
 * server. Signed-in staff only: an open lookup endpoint is a free address API
 * for anyone who finds it, billed to us against a daily limit.
 *
 * Returns an empty list rather than an error when the key is missing or the
 * postcode is unknown, because the address step must stay usable by hand.
 */

export const dynamic = "force-dynamic";

const BASE_URL = "https://portal.goaddress.io/api";

type GoAddressEntry = {
  flat?: string | null;
  /* The docs say houseNo; the live API sends house_no. Both are accepted. */
  houseNo?: string | null;
  house_no?: string | null;
  building_name?: string | null;
  organisation?: string | null;
  street?: string | null;
  addressid?: string;
  raw_address?: string;
  postcode?: string;
  post_town?: string | null;
  town?: string | null;
  county?: string | null;
};

type GoAddressResponse = {
  new_address_res?: GoAddressEntry[];
  address_info?: { post_town?: string | null; town?: string | null; county?: string | null };
  remaining_today?: number;
  daily_limit?: number;
};

export async function GET(request: NextRequest) {
  await requireAccess();

  const parsed = parsePostcode(request.nextUrl.searchParams.get("postcode") ?? "");
  if (!parsed) {
    return NextResponse.json({ ok: true, addresses: [], reason: "invalid-postcode" });
  }

  const key = await getAddressApiKey();
  if (!key) {
    return NextResponse.json({ ok: true, addresses: [], reason: "not-configured" });
  }

  try {
    // The API accepts a postcode with or without a space; sent without.
    const compact = parsed.formatted.replace(/\s+/g, "");

    const response = await fetch(`${BASE_URL}/address/${encodeURIComponent(compact)}`, {
      cache: "no-store",
      headers: { accept: "application/json", authorization: `Bearer ${key}` },
    });

    if (!response.ok) {
      // 404 is simply a postcode with no addresses, which is not a fault.
      if (response.status === 404) {
        return NextResponse.json({ ok: true, addresses: [], reason: "not-found" });
      }
      if (response.status === 401 || response.status === 403) {
        console.error("Address lookup rejected the key:", response.status);
        return NextResponse.json({ ok: true, addresses: [], reason: "unauthorized" });
      }

      console.error("Address lookup failed:", response.status, await response.text());
      return NextResponse.json({ ok: true, addresses: [], reason: "unavailable" });
    }

    const data = (await response.json()) as GoAddressResponse;
    const info = data.address_info ?? {};

    const addresses: AddressSuggestion[] = (data.new_address_res ?? []).map((entry, index) => {
      const line1 = entry.raw_address?.trim() || "";

      /*
       * A flat or building name only belongs on a second line when the first
       * does not already carry it - "Flat 1, 74 Milton Road" needs no second
       * line reading "1".
       */
      const secondary = [entry.organisation, entry.building_name, entry.flat]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .filter((part) => !line1.toLowerCase().includes(part.toLowerCase()))
        .join(", ");

      const houseNumber = (entry.houseNo ?? entry.house_no)?.trim();
      const street = [houseNumber, entry.street?.trim()].filter(Boolean).join(" ");

      return {
        id: entry.addressid ?? `${index}`,
        label: line1 || street || compact,
        line1: line1 || street,
        line2: secondary || null,
        town:
          entry.post_town?.trim() ||
          entry.town?.trim() ||
          info.post_town?.trim() ||
          info.town?.trim() ||
          null,
        county: entry.county?.trim() || info.county || null,
        postcode: entry.postcode?.trim() || parsed.formatted,
      };
    });

    return NextResponse.json({
      ok: true,
      addresses,
      // Surfaced so the wizard can warn before the daily allowance runs out.
      remainingToday: data.remaining_today ?? null,
      dailyLimit: data.daily_limit ?? null,
    });
  } catch (error) {
    console.error("Address lookup threw:", error);
    return NextResponse.json({ ok: true, addresses: [], reason: "unavailable" });
  }
}
