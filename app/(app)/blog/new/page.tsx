import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import BlogEditor from "../BlogEditor";

export const metadata: Metadata = { title: "New article" };

export default async function NewBlogPostPage() {
  await pageAdmin();

  return (
    <>
      <PageHeader
        title="New article"
        subtitle="Write it, add a banner, fill in the search fields, then publish."
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "New article" }]}
      />
      <BlogEditor />
    </>
  );
}
