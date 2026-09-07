import "server-only";
import { and, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { landlords, properties, tenants, users } from "@/db/schema";
import { normalizeUKPhoneDetailed } from "@/lib/phone";
import { parsePostcode } from "@/lib/postcode";
import {
  landlordVisibilityFilter,
  propertyVisibilityFilter,
  tenantVisibilityFilter,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Global search.
 *
 * Every branch is scoped through the same visibility filters the list pages
 * use, so search can never become a way around permissions. A query that looks
 * like a phone number is normalised first, so any format finds the record.
 */

export type SearchResult = {
  kind: "landlord" | "property" | "tenant" | "person";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
};

const LIMIT_PER_KIND = 8;

export async function globalSearch(
  query: string,
  context: AccessContext,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const term = `%${trimmed}%`;
  const phone = normalizeUKPhoneDetailed(trimmed);
  const postcode = parsePostcode(trimmed);

  const [landlordRows, propertyRows, tenantRows, personRows] = await Promise.all([
    db
      .select({
        id: landlords.id,
        name: landlords.name,
        originalPhone: landlords.originalPhone,
        email: landlords.email,
      })
      .from(landlords)
      .where(
        withVisibility(
          and(
            isNull(landlords.deletedAt),
            or(
              ilike(landlords.name, term),
              ilike(landlords.email, term),
              ilike(landlords.originalPhone, term),
              phone.ok ? eq(landlords.normalizedPhone, phone.normalized) : undefined,
            ),
          ),
          landlordVisibilityFilter(context),
        ),
      )
      .limit(LIMIT_PER_KIND),

    db
      .select({
        id: properties.id,
        reference: properties.reference,
        title: properties.title,
        formattedAddress: properties.formattedAddress,
        postcode: properties.postcode,
        listingStatus: properties.listingStatus,
      })
      .from(properties)
      .where(
        withVisibility(
          and(
            isNull(properties.deletedAt),
            or(
              ilike(properties.reference, term),
              ilike(properties.title, term),
              ilike(properties.formattedAddress, term),
              ilike(properties.postcode, term),
              postcode ? eq(properties.outcode, postcode.outcode) : undefined,
            ),
          ),
          propertyVisibilityFilter(context),
        ),
      )
      .limit(LIMIT_PER_KIND),

    context.isFronter
      ? Promise.resolve([])
      : db
          .select({
            id: tenants.id,
            name: tenants.name,
            originalPhone: tenants.originalPhone,
            area: tenants.area,
            status: tenants.status,
          })
          .from(tenants)
          .where(
            withVisibility(
              and(
                isNull(tenants.deletedAt),
                or(
                  ilike(tenants.name, term),
                  ilike(tenants.email, term),
                  ilike(tenants.originalPhone, term),
                  phone.ok ? eq(tenants.normalizedPhone, phone.normalized) : undefined,
                ),
              ),
              tenantVisibilityFilter(context),
            ),
          )
          .limit(LIMIT_PER_KIND),

    // Only administrators can search the staff directory.
    context.isAdmin
      ? db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(
            and(
              isNull(users.deletedAt),
              or(ilike(users.fullName, term), ilike(users.email, term)) as SQL,
            ),
          )
          .limit(LIMIT_PER_KIND)
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [];

  for (const row of landlordRows) {
    results.push({
      kind: "landlord",
      id: row.id,
      title: row.name,
      subtitle: [row.originalPhone, row.email].filter(Boolean).join(" · "),
      href: `/landlords/${row.id}`,
    });
  }

  for (const row of propertyRows) {
    results.push({
      kind: "property",
      id: row.id,
      title: row.title ?? row.formattedAddress,
      subtitle: `${row.reference} · ${row.postcode}`,
      href: `/properties/${row.id}`,
      badge: row.listingStatus,
    });
  }

  for (const row of tenantRows) {
    results.push({
      kind: "tenant",
      id: row.id,
      title: row.name,
      subtitle: [row.originalPhone, row.area].filter(Boolean).join(" · "),
      href: `/tenants/${row.id}`,
      badge: row.status,
    });
  }

  for (const row of personRows) {
    results.push({
      kind: "person",
      id: row.id,
      title: row.fullName,
      subtitle: row.email,
      href: `/team/users?q=${encodeURIComponent(row.email)}`,
      badge: row.role,
    });
  }

  return results;
}
