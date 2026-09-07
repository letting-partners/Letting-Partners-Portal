import type { Metadata } from "next";
import { pageAgentOrAdmin } from "@/lib/auth/page-guard";
import { Images } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/layout";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { ClearFilters, FilterSelect, Pagination, SearchInput } from "@/components/ui/TableControls";
import { formatDate } from "@/lib/dates";
import { listImages } from "@/services/images";
import { isStorageConfigured } from "@/services/storage";
import ImageTile from "./ImageTile";

export const metadata: Metadata = { title: "Image library" };

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await pageAgentOrAdmin();
  const params = await searchParams;

  const storageReady = isStorageConfigured();

  const result = await listImages(context, {
    search: params.q,
    mine: params.mine === "1",
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <>
      <PageHeader
        title="Image library"
        subtitle="Photos are stored once and can be reused across properties. Alt text is generated on upload and can be edited."
      />

      {!storageReady && (
        <div className="alert alert--warning" style={{ marginBottom: 16 }}>
          <span>
            File storage is not configured yet. Add <code>BLOB_READ_WRITE_TOKEN</code> to the
            portal environment to enable uploads.
          </span>
        </div>
      )}

      <div className="grid-sidebar">
        <div className="card">
          <div className="filter-bar">
            <SearchInput placeholder="Search file name or alt text..." />

            <FilterSelect
              paramName="mine"
              label="Uploader"
              allLabel="Everyone"
              options={[{ value: "1", label: "Only mine" }]}
            />

            <ClearFilters keys={["q", "mine"]} />
          </div>

          <div className="card-body">
            {result.rows.length === 0 ? (
              <EmptyState
                icon={<Images size={18} />}
                title="No images yet"
                message="Upload property photos here, or straight from a property page. The same photo can be reused without uploading it twice."
              />
            ) : (
              <div className="image-grid">
                {result.rows.map((image) => (
                  <ImageTile
                    key={image.id}
                    id={image.id}
                    url={image.url}
                    fileName={image.fileName}
                    altText={image.altText ?? ""}
                    usageCount={image.usageCount}
                    meta={`${formatBytes(image.sizeBytes)} · ${formatDate(image.createdAt)} · ${
                      image.uploadedBy?.fullName ?? "Unknown"
                    }`}
                    canDelete={context.isAdmin || image.uploadedById === context.user.id}
                  />
                ))}
              </div>
            )}
          </div>

          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            pageSize={result.pageSize}
          />
        </div>

        <Card title="Upload">
          <ImageUploader />
          <p className="subtle small" style={{ marginTop: 12 }}>
            Alt text is written for you from the property details, or from the photo itself when a
            vision provider is configured. You can always edit it.
          </p>
        </Card>
      </div>
    </>
  );
}
