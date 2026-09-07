import { config as loadEnv } from "dotenv";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Proves the object store actually works end to end: writes a small file,
 * fetches it back over the public URL the portal will hand to browsers, then
 * deletes it. The public read is the part that usually fails - credentials can
 * be perfect while the bucket is still private.
 *
 *   node scripts/check-storage.mjs
 */

const endpointRaw = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const region = process.env.S3_REGION ?? "auto";
const publicBase = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");

const missing = [
  ["S3_ENDPOINT", endpointRaw],
  ["S3_BUCKET", bucket],
  ["S3_ACCESS_KEY_ID", accessKeyId],
  ["S3_SECRET_ACCESS_KEY", secretAccessKey],
  ["S3_PUBLIC_BASE_URL", publicBase],
].filter(([, value]) => !value).map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing: ${missing.join(", ")}\nSee .env.example.`);
  process.exit(1);
}

/*
 * The S3 API endpoint is not a public address - every request to it must be
 * signature-signed, so a browser fetch gets a 400. It is easy to paste into
 * the wrong variable and the failure looks unrelated, so name it here.
 */
if (publicBase.includes(".r2.cloudflarestorage.com")) {
  console.error(`
S3_PUBLIC_BASE_URL is set to the S3 API endpoint, which is private. It needs
the bucket's public address instead:

  Cloudflare -> R2 -> ${bucket} -> Settings
    Public access -> enable the public development URL, or
    Custom Domains -> connect one

  Then set S3_PUBLIC_BASE_URL to that address, for example
    https://pub-<hash>.r2.dev
    https://images.lettingpartners.co.uk
`);
  process.exit(1);
}

const endpoint = endpointRaw.replace(new RegExp(`/${bucket}/?$`), "");
const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

const key = `health/check-${Date.now().toString(36)}.txt`;
const body = `letting-partners storage check ${new Date().toISOString()}`;
let failures = 0;

function report(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
}

console.log(`\nBucket ${bucket} at ${endpoint}\n`);

try {
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "text/plain" }),
  );
  report("write", true, key);
} catch (error) {
  report("write", false, error.message);
  console.log("\nCredentials or bucket name are wrong. Nothing else can be checked.\n");
  process.exit(1);
}

try {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await result.Body.transformToString();
  report("read back over the S3 API", text === body);
} catch (error) {
  report("read back over the S3 API", false, error.message);
}

const publicUrl = `${publicBase}/${key}`;
try {
  const response = await fetch(publicUrl);
  const text = response.ok ? await response.text() : "";
  report(
    "public read over S3_PUBLIC_BASE_URL",
    response.ok && text === body,
    response.ok ? publicUrl : `HTTP ${response.status} at ${publicUrl}`,
  );
  if (!response.ok) {
    console.log(
      "\n  Uploads will succeed but photos will not display, so listings\n" +
        "  cannot be published. Attach a custom domain to the bucket, or\n" +
        "  enable its public development URL, and set S3_PUBLIC_BASE_URL\n" +
        "  to that address.",
    );
  }
} catch (error) {
  report("public read over S3_PUBLIC_BASE_URL", false, error.message);
}

try {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  report("delete", true);
} catch (error) {
  report("delete", false, error.message);
}

console.log(`\n${failures === 0 ? "Storage is ready." : `${failures} check(s) failed.`}\n`);
process.exit(failures === 0 ? 0 : 1);
