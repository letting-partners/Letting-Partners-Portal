import type { Metadata } from "next";
import { SERVICE_GROUPS } from "@/lib/services";
import ServiceLandingPage from "@/components/ServiceLandingPage";

const group = SERVICE_GROUPS.find((g) => g.href === "/landlord-services")!;

export const metadata: Metadata = {
  title: "Landlord Services | Letting Partners",
  description:
    "Professional landlord services from Letting Partners - property letting, tenant placement, rent to rent, full management, and compliance support across London and Birmingham.",
  keywords: [
    "landlord services London",
    "property letting London",
    "find a tenant London",
    "rent to rent London",
    "property management East London",
  ],
};

export default function LandlordServicesPage() {
  return <ServiceLandingPage group={group} />;
}
