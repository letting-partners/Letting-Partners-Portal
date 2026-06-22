import type { Metadata } from "next";
import { SERVICE_GROUPS } from "@/lib/services";
import ServiceLandingPage from "@/components/ServiceLandingPage";

const group = SERVICE_GROUPS.find((g) => g.href === "/other-services")!;

export const metadata: Metadata = {
  title: "Additional Services | Letting Partners",
  description:
    "Repair and maintenance co-ordination, mortgage consultancy, and construction support from Letting Partners - complete property services for owners and investors.",
  keywords: [
    "property repair maintenance London",
    "mortgage consultancy London",
    "construction development property London",
    "property services London",
  ],
};

export default function OtherServicesPage() {
  return <ServiceLandingPage group={group} />;
}
