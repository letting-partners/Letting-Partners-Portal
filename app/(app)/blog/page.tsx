import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileText, Plus } from "lucide-react";
import { pageAdmin } from "@/lib/auth/page-guard";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatRelative } from "@/lib/dates";
import { listBlogPosts, type BlogStatus } from "@/services/blog";
import BlogRowActions from "./BlogRowActions";

export const metadata: Metadata = { title: "Blog" };

const TABS: { value: BlogStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "TRASHED", label: "Trash" },
];

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const context = await pageAdmin();
  const params = await searchParams;

  const status = TABS.some((tab) => tab.value === params.status)
    ? (params.status as BlogStatus | "ALL")
    : "ALL";

  const { rows, counts } = await listBlogPosts(context, {
    status: status === "ALL" ? undefined : status,
    search: params.q,
  });

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="Articles on the public website."
        breadcrumbs={[{ label: "Blog" }]}
        actions={
          <Link href="/blog/new" className="btn btn--primary">
            <Plus size={15} />
            New article
          </Link>
        }
      />

      <div className="card">
        <div className="tabs">
          {TABS.map((tab) => {
            const count =
              tab.value === "ALL"
                ? (counts.DRAFT ?? 0) + (counts.PUBLISHED ?? 0)
                : (counts[tab.value] ?? 0);

            return (
              <Link
                key={tab.value}
                href={tab.value === "ALL" ? "/blog" : `/blog?status=${tab.value}`}
                className={status === tab.value ? "tab tab--active" : "tab"}
              >
                {tab.label}
                <span className="subtle small"> {count}</span>
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText size={18} />}
            title={status === "TRASHED" ? "Nothing in the trash" : "No articles yet"}
            message={
              status === "TRASHED"
                ? "Articles you remove from the website are kept here and can be restored."
                : "Write an article to give the website something for search engines to find."
            }
            action={
              status === "TRASHED" ? undefined : (
                <Link href="/blog/new" className="btn btn--primary btn--sm">
                  New article
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Focus keyword</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Updated</th>
                  <th className="table-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="blog-row-title">
                        {row.bannerImageUrl && (
                          <span className="blog-row-thumb">
                            <Image
                              src={row.bannerImageUrl}
                              alt=""
                              fill
                              sizes="52px"
                              className="lp-cover-img"
                            />
                          </span>
                        )}
                        <span>
                          <Link href={`/blog/${row.id}`} className="table-primary">
                            {row.title}
                          </Link>
                          <span className="table-secondary truncate" style={{ maxWidth: 380 }}>
                            /blog/{row.slug}
                          </span>
                        </span>
                      </span>
                    </td>

                    <td className="table-secondary">{row.focusKeyword ?? "-"}</td>

                    <td>
                      <StatusBadge status={row.status} />
                    </td>

                    <td className="table-secondary">
                      {row.publishedAt ? formatDate(row.publishedAt) : "-"}
                    </td>

                    <td className="table-secondary">{formatRelative(row.updatedAt)}</td>

                    <td className="table-actions">
                      <BlogRowActions
                        postId={row.id}
                        slug={row.slug}
                        title={row.title}
                        status={row.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
