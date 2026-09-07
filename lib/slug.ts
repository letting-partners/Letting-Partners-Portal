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
 * Builds a human readable slug such as
 * "2-bedroom-flat-manchester-m14-lp-1042".
 */
export function buildPropertySlug(source: SlugSource): string {
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

  if (parts.length === 0 && source.title) parts.push(source.title);

  parts.push(source.reference);

  return slugify(parts.join(" ")) || slugify(source.reference);
}

/** Append -2, -3 ... until the slug is unique for the caller. */
export function disambiguateSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}
