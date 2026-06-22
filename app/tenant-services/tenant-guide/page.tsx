import type { Metadata } from "next";
import ServiceDetailPage from "@/components/ServiceDetailPage";
import { getServiceDetailByHref } from "@/lib/service-pages";

const service = getServiceDetailByHref("/tenant-services/tenant-guide")!;

export const metadata: Metadata = {
  title: service.seoTitle,
  description: service.seoDescription,
  keywords: service.keywords,
};

export default function TenantGuidePage() {
  return <ServiceDetailPage service={service} />;
}
