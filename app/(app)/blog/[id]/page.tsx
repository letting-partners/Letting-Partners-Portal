import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageAdmin } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import { getBlogPost } from "@/services/blog";
import BlogEditor from "../BlogEditor";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await pageAdmin();
  const { id } = await params;
  const post = await getBlogPost(id, context);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.title}
        subtitle={post.status === "PUBLISHED" ? "Live on the website." : "Not published yet."}
        breadcrumbs={[{ label: "Blog", href: "/blog" }, { label: "Edit" }]}
      />
      <BlogEditor
        post={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          body: post.body,
          bannerImageUrl: post.bannerImageUrl,
          bannerImageAlt: post.bannerImageAlt,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          focusKeyword: post.focusKeyword,
          schemaJson: post.schemaJson,
          status: post.status,
          publishedAt: post.publishedAt?.toISOString() ?? null,
        }}
      />
    </>
  );
}
