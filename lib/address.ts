/**
 * One address returned by the postcode lookup.
 *
 * Shared between the proxy route and the wizard so both agree on the shape,
 * and so the wizard does not import from an API route.
 */
export type AddressSuggestion = {
  id: string;
  /** What the agent reads in the list. */
  label: string;
  line1: string;
  line2: string | null;
  town: string | null;
  county: string | null;
  postcode: string;
};

export type AddressLookupResponse = {
  ok: boolean;
  addresses: AddressSuggestion[];
  reason?: "invalid-postcode" | "not-configured" | "not-found" | "unauthorized" | "unavailable";
  remainingToday?: number | null;
  dailyLimit?: number | null;
};
