import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/layout";
import { getProperty } from "@/services/properties";
import { listBookableRooms } from "@/services/deals";
import { listSelectableTenants } from "@/services/tenants";
import StartViewingForm from "./StartViewingForm";

export const metadata: Metadata = { title: "Start viewing" };

export default async function StartViewingPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const context = await pageAgentOrAdmin();
  const { propertyId } = await searchParams;

  if (!propertyId) redirect("/properties");

  const data = await getProperty(propertyId, context);
  if (!data) notFound();

  const [rooms, tenants] = await Promise.all([
    data.property.propertyType === "SHARED"
      ? listBookableRooms(propertyId)
      : Promise.resolve([]),
    listSelectableTenants(context),
  ]);

  return (
    <>
      <PageHeader
        title="Start viewing"
        subtitle="Scheduling a viewing opens a deal and moves the property into the pipeline."
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: data.property.reference, href: `/properties/${propertyId}` },
          { label: "Start viewing" },
        ]}
      />

      <div style={{ maxWidth: 720 }}>
        <StartViewingForm
          property={{
            id: data.property.id,
            reference: data.property.reference,
            address: data.property.title ?? data.property.formattedAddress,
            propertyType: data.property.propertyType,
          }}
          rooms={rooms}
          tenants={tenants.map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            area: tenant.area,
            maxBudgetPence: tenant.maxBudgetPence,
          }))}
        />
      </div>
    </>
  );
}
