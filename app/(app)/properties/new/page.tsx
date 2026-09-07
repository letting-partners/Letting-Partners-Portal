import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { landlords } from "@/db/schema";
import { PageHeader } from "@/components/ui/layout";
import { normalizeUKPhone } from "@/lib/phone";
import PropertyWizard from "./PropertyWizard";

export const metadata: Metadata = { title: "Add property" };

/**
 * Entry point for onboarding. Arrives either from an interested call (with the
 * phone number in the query) or directly from Properties.
 */
export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{
    callId?: string;
    phone?: string;
    display?: string;
    landlordId?: string;
  }>;
}) {
  await pageAccess();
  const params = await searchParams;

  // If the number already belongs to a landlord, skip straight to the property
  // steps rather than inviting a duplicate.
  const existingLandlord = await findLandlord(params.landlordId, params.phone);

  return (
    <>
      <PageHeader
        title="Add landlord and property"
        subtitle="Seven steps. Everything is saved as you go, so a refresh loses nothing."
        breadcrumbs={[{ label: "Properties", href: "/properties" }, { label: "Add property" }]}
      />

      <div style={{ maxWidth: 860 }}>
        <PropertyWizard
          callId={params.callId}
          phone={params.phone}
          display={params.display}
          existingLandlord={existingLandlord}
        />
      </div>
    </>
  );
}

async function findLandlord(landlordId?: string, phone?: string) {
  if (landlordId) {
    const rows = await db
      .select({ id: landlords.id, name: landlords.name, originalPhone: landlords.originalPhone })
      .from(landlords)
      .where(and(eq(landlords.id, landlordId), isNull(landlords.deletedAt)))
      .limit(1);

    const row = rows[0];
    return row ? { id: row.id, name: row.name, phone: row.originalPhone } : null;
  }

  const normalized = normalizeUKPhone(phone);
  if (!normalized) return null;

  const rows = await db
    .select({ id: landlords.id, name: landlords.name, originalPhone: landlords.originalPhone })
    .from(landlords)
    .where(and(eq(landlords.normalizedPhone, normalized), isNull(landlords.deletedAt)))
    .limit(1);

  const row = rows[0];
  return row ? { id: row.id, name: row.name, phone: row.originalPhone } : null;
}
