import "server-only";
import { del, put } from "@vercel/blob";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/env";

/**
 * File storage behind a narrow interface.
 *
 * Two drivers, chosen by configuration:
 *
 *   s3     any S3-compatible object store. Cloudflare R2 is one, and is what
 *          this deployment uses; the same settings work for AWS S3, Backblaze
 *          B2 or MinIO by changing the endpoint.
 *   blob   Vercel Blob, used when no S3 bucket is configured.
 *
 * Nothing outside this module knows which is active.
 *
 * Note on public URLs: an object store is not automatically readable from the
 * internet. Uploads are addressed publicly through `S3_PUBLIC_BASE_URL` - a
 * custom domain on the bucket, or the bucket's public development URL - so
 * that is required alongside the credentials.
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

/* ------------------------------------------------------------ S3 driver */

type S3Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  publicBaseUrl: string;
};

/** The S3 configuration, or null when the store is not set up. */
function s3Config(): S3Config | null {
  let env;
  try {
    env = serverEnv();
  } catch {
    return null;
  }

  if (
    !env.S3_BUCKET ||
    !env.S3_ENDPOINT ||
    !env.S3_ACCESS_KEY_ID ||
    !env.S3_SECRET_ACCESS_KEY ||
    !env.S3_PUBLIC_BASE_URL
  ) {
    return null;
  }

  return {
    // R2's S3 endpoint may be given with or without the bucket appended; the
    // client wants the account endpoint, and names the bucket separately.
    endpoint: env.S3_ENDPOINT.replace(new RegExp(`/${env.S3_BUCKET}/?$`), ""),
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
    publicBaseUrl: env.S3_PUBLIC_BASE_URL.replace(/\/$/, ""),
  };
}

let cachedClient: S3Client | null = null;

function s3Client(config: S3Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      // R2 and most S3-compatible stores require path-style addressing.
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

async function uploadToS3(file: File, pathname: string, config: S3Config): Promise<StoredFile> {
  const body = new Uint8Array(await file.arrayBuffer());

  await s3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: pathname,
      Body: body,
      ContentType: file.type,
      // Listing photos are immutable once written - the path carries a unique
      // stamp - so they can be cached hard.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    url: `${config.publicBaseUrl}/${pathname}`,
    pathname,
    contentType: file.type,
    sizeBytes: file.size,
  };
}

async function deleteFromS3(url: string, config: S3Config): Promise<void> {
  if (!url.startsWith(config.publicBaseUrl)) return;
  const key = url.slice(config.publicBaseUrl.length + 1);
  if (!key) return;

  await s3Client(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

/* ---------------------------------------------------------------- public */

export async function uploadFile(
  file: File,
  folder: "properties" | "avatars" | "chat" = "properties",
): Promise<StoredFile> {
  assertUploadable(file);

  const pathname = buildPathname(file.name, folder);
  const config = s3Config();

  if (config) {
    try {
      return await uploadToS3(file, pathname, config);
    } catch (error) {
      console.error("S3 upload failed:", error);
      throw new StorageError("The upload failed. Please try again.");
    }
  }

  const env = serverEnv();
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new StorageError(
      "File storage is not configured. Set the S3 variables (or BLOB_READ_WRITE_TOKEN) to enable uploads.",
    );
  }

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
  const config = s3Config();

  // A failed remote delete must never block archiving the database record.
  if (config) {
    try {
      await deleteFromS3(url, config);
    } catch (error) {
      console.error("S3 delete failed:", error);
    }
    return;
  }

  let env;
  try {
    env = serverEnv();
  } catch {
    return;
  }
  if (!env.BLOB_READ_WRITE_TOKEN) return;

  try {
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    console.error("Blob delete failed:", error);
  }
}

export function isStorageConfigured(): boolean {
  if (s3Config()) return true;
  try {
    return Boolean(serverEnv().BLOB_READ_WRITE_TOKEN);
  } catch {
    return false;
  }
}

/** Which driver is active, for the settings screen. */
export function storageDriver(): "S3" | "Vercel Blob" | "none" {
  if (s3Config()) return "S3";
  try {
    return serverEnv().BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "none";
  } catch {
    return "none";
  }
}
