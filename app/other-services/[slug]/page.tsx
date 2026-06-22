import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ServiceDetailPage from "@/components/ServiceDetailPage";
import { OTHER_SERVICE_PAGES } from "@/lib/services";
import { getServiceDetailBySlug } from "@/lib/service-pages";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  return OTHER_SERVICE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const service = getServiceDetailBySlug(slug);
  if (!service) return {};
  return {
    title: service.seoTitle,
    description: service.seoDescription,
    keywords: service.keywords,
  };
}

export default async function OtherServiceSlugPage({ params }: Props) {
  const { slug } = params;
  const service = getServiceDetailBySlug(slug);
  if (!service) notFound();
  return <ServiceDetailPage service={service} />;
}
