import type { Metadata } from "next";
import ServiceDetailPage from "@/components/ServiceDetailPage";
import { getServiceDetailByHref } from "@/lib/service-pages";

const service = getServiceDetailByHref("/specialist-legal-support/disputes-notices")!;

export const metadata: Metadata = {
  title: service.seoTitle,
  description: service.seoDescription,
  keywords: service.keywords,
};

export default function DisputesNoticesPage() {
  return <ServiceDetailPage service={service} />;
}
