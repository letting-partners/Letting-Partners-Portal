import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import { findLandlordSummary } from "@/services/landlords";
import PropertyWizard from "./PropertyWizard";

export const metadata: Metadata = { title: "Add property" };

/**
 * Onboarding as a page.
 *
 * A call that goes well continues into the wizard inside the start-call popup,
 * so this route is the way in from Properties - adding a landlord and property
 * that did not come from a call being made right now.
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
  const existingLandlord = await findLandlordSummary({
    landlordId: params.landlordId,
    phone: params.phone,
  });

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
