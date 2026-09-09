/**
 * Search metadata for a property listing.
 *
 * Every published property needs a title, a description and keywords whether
 * or not an agent filled them in, so these are derived from what the listing
 * already says. An agent's own values always win; this only fills the gap.
 *
 * Pure and free of `server-only`, so the rules can be unit tested.
 */

/** How long a title may be before search results cut it off. */
export const MAX_TITLE_LENGTH = 60;

/** How long a meta description may be before search results cut it off. */
export const MAX_DESCRIPTION_LENGTH = 160;

/**
 * The letting types worth ranking for, and the ways people write them.
 *
 * Matched against the listing's own words rather than a dropdown, because the
 * useful term is almost always in the title an agent wrote - "en-suite",
 * "studio", "double room" - and rarely in a structured field.
 */
const ROOM_TYPES: { label: string; patterns: RegExp[] }[] = [
  { label: "en-suite room", patterns: [/\ben[\s-]?suites?\b/i] },
  { label: "studio flat", patterns: [/\bstudios?\b/i] },
  { label: "double room", patterns: [/\bdouble\s+(?:room|bedroom)s?\b/i, /\bdoubles?\b/i] },
  { label: "single room", patterns: [/\bsingle\s+(?:room|bedroom)s?\b/i] },
  { label: "master room", patterns: [/\bmaster\s+(?:room|bedroom)s?\b/i] },
  { label: "twin room", patterns: [/\btwin\s+(?:room|bedroom)s?\b/i] },
  { label: "shared house", patterns: [/\bshared\s+house\b/i, /\bhouse\s*share\b/i, /\bhmo\b/i] },
];

/** The letting terms this listing genuinely mentions, most specific first. */
export function detectRoomTypes(text: string): string[] {
  if (!text) return [];
  return ROOM_TYPES.filter((type) => type.patterns.some((pattern) => pattern.test(text))).map(
    (type) => type.label,
  );
}

/**
 * Cut to a length without splitting a word.
 *
 * A title is cut silently because it has to read as a title. A description
 * gets an ellipsis, because a sentence stopping dead looks like a fault.
 */
export function truncateAtWord(value: string, max: number, ellipsis = false): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const limit = ellipsis ? max - 1 : max;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");

  // Only fall back to a hard cut when there is no sensible break at all.
  const trimmed = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(
    /[\s,;:.-]+$/,
    "",
  );

  return ellipsis ? `${trimmed}…` : trimmed;
}

export type ListingSeoInput = {
  title: string | null;
  description?: string | null;
  /** Property type as the site describes it, e.g. "Shared house". */
  typeLabel?: string | null;
  area?: string | null;
  town?: string | null;
  outcode?: string | null;
  bedrooms?: number | null;
  /** What an agent typed, which always wins. */
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type ListingSeo = {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
};

/**
 * Keywords are the letting type paired with the place, which is how people
 * search: "en-suite room Harrow", not "en-suite" or "Harrow" alone.
 */
export function deriveListingKeywords(input: ListingSeoInput): string[] {
  const haystack = [input.title, input.description].filter(Boolean).join(" ");

  const types = detectRoomTypes(haystack);
  if (types.length === 0 && input.typeLabel) types.push(input.typeLabel.toLowerCase());
  if (types.length === 0) types.push("property");

  const places = [input.area, input.town, input.outcode]
    .map((place) => place?.trim())
    .filter((place): place is string => Boolean(place));

  // De-duplicated case-insensitively: "Harrow" and "harrow" are one place.
  const seenPlaces = new Set<string>();
  const uniquePlaces = places.filter((place) => {
    const key = place.toLowerCase();
    if (seenPlaces.has(key)) return false;
    seenPlaces.add(key);
    return true;
  });

  const keywords: string[] = [];
  const push = (value: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    if (clean && !keywords.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      keywords.push(clean);
    }
  };

  for (const type of types) {
    for (const place of uniquePlaces) push(`${type} ${place}`);
    push(`${type} to rent`);
  }

  for (const place of uniquePlaces) {
    push(`property to rent ${place}`);
    push(`rooms to rent ${place}`);
  }

  return keywords.slice(0, 10);
}

export function deriveListingSeo(input: ListingSeoInput): ListingSeo {
  const title = (input.title ?? "").trim();

  const metaTitle = input.metaTitle?.trim()
    ? truncateAtWord(input.metaTitle, MAX_TITLE_LENGTH)
    : truncateAtWord(title || "Property to rent", MAX_TITLE_LENGTH);

  const described = input.metaDescription?.trim()
    ? input.metaDescription
    : buildDescription(input);

  return {
    metaTitle,
    metaDescription: truncateAtWord(described, MAX_DESCRIPTION_LENGTH, true),
    keywords: deriveListingKeywords(input),
  };
}

/**
 * A description written from the listing when nobody has written one. Prefers
 * the agent's own words, and only falls back to assembling a sentence from the
 * structured fields when there is no description at all.
 */
function buildDescription(input: ListingSeoInput): string {
  const description = input.description?.replace(/<[^>]+>/g, " ").trim();
  if (description) return description;

  const place = [input.area, input.outcode].filter(Boolean).join(" ");
  const bedrooms = input.bedrooms ? `${input.bedrooms} bedroom ` : "";
  const type = (input.typeLabel ?? "property").toLowerCase();

  return `${bedrooms}${type} to rent${place ? ` in ${place}` : ""}. Arrange a viewing with Letting Partners.`;
}
