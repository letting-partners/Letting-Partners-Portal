import "server-only";
import { del, put } from "@vercel/blob";
import { serverEnv } from "@/lib/env";

/**
 * File storage behind a narrow interface.
 *
 * Vercel Blob is the implementation today; nothing outside this module knows
 * that, so moving to S3 or R2 later is a change here and nowhere else.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type StoredFile = {
  url: string;
  pathname: string;
  contentType: string;
  sizeBytes: number;
};

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/** Reject anything that is not an image we are prepared to serve. */
export function assertUploadable(file: { type: string; size: number; name: string }): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new StorageError("Upload a JPEG, PNG, WebP or AVIF image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new StorageError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (file.size === 0) throw new StorageError("That file is empty.");
}

/** Namespaced, collision-proof path. */
function buildPathname(fileName: string, folder: string): string {
  const extension = fileName.includes(".") ? fileName.split(".").pop()! : "jpg";
  const safeBase = fileName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${folder}/${safeBase || "image"}-${stamp}${random}.${extension}`;
}

export async function uploadFile(
  file: File,
  folder: "properties" | "avatars" | "chat" = "properties",
): Promise<StoredFile> {
  assertUploadable(file);

  const env = serverEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageError(
      "File storage is not configured. Set BLOB_READ_WRITE_TOKEN to enable uploads.",
    );
  }

  const pathname = buildPathname(file.name, folder);

  try {
    const result = await put(pathname, file, {
      access: "public",
      token: env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      // Paths are already unique, so the extra suffix only makes them uglier.
      addRandomSuffix: false,
    });

    return {
      url: result.url,
      pathname: result.pathname,
      contentType: file.type,
      sizeBytes: file.size,
    };
  } catch (error) {
    console.error("Blob upload failed:", error);
    throw new StorageError("The upload failed. Please try again.");
  }
}

export async function deleteFile(url: string): Promise<void> {
  const env = serverEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) return;

  try {
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    // A missing remote file must not block archiving the database record.
    console.error("Blob delete failed:", error);
  }
}

export function isStorageConfigured(): boolean {
  try {
    return Boolean(serverEnv().BLOB_READ_WRITE_TOKEN);
  } catch {
    return false;
  }
}
