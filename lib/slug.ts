import { getOutcode } from "./postcode";

/**
 * Public URLs are generated from the listing, but the property keeps a stable
 * uuid internally, so retitling a property never breaks a relationship - only
 * its public URL, which is why the slug is stored and reused once assigned.
 */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    // Strip combining diacritical marks left behind by NFKD.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export type SlugSource = {
  title?: string | null;
  category?: string | null;
  bedrooms?: number | null;
  town?: string | null;
  area?: string | null;
  postcode?: string | null;
  reference: string;
};

/**
 * Builds a readable slug from the listing title, such as
 * "spacious-master-room-forest-gate".
 *
 * The title alone, because that is what the listing is called and what reads
 * well in a search result or a shared link. The reference is deliberately not
 * in it - lp-0003 means nothing to anyone outside the office - and uniqueness
 * comes from disambiguateSlug instead.
 *
 * Where there is no title, the structured fields stand in so the URL is still
 * descriptive rather than falling back to a reference number.
 */
export function buildPropertySlug(source: SlugSource): string {
  const fromTitle = source.title ? slugify(source.title) : "";
  if (fromTitle) return fromTitle;

  const parts: string[] = [];

  if (source.bedrooms && source.bedrooms > 0) {
    parts.push(`${source.bedrooms}-bedroom`);
  }
  if (source.category) {
    parts.push(source.category.toLowerCase().replace(/_/g, "-"));
  }
  if (source.town) parts.push(source.town);
  else if (source.area) parts.push(source.area);

  const outcode = getOutcode(source.postcode);
  if (outcode) parts.push(outcode);

  return slugify(parts.join(" ")) || slugify(source.reference);
}

/** Append -2, -3 ... until the slug is unique for the caller. */
export function disambiguateSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}
