import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * A single pooled connection per process. Next.js recreates modules on every
 * hot reload in development, so the client is cached on globalThis to avoid
 * exhausting database connections.
 *
 * Two drivers are supported:
 *
 *   postgres://...   postgres.js against a real server. This is production.
 *   pglite://<dir>   PGlite, a real Postgres compiled to WebAssembly that runs
 *                    in-process. Local development only - it needs no server,
 *                    no install and no credentials, which makes it useful for
 *                    getting started before a database has been provisioned.
 *
 * The drizzle query API is identical across both, so nothing downstream knows
 * or cares which one is in use.
 */

declare global {
  var __portalDb: PostgresJsDatabase<typeof schema> | undefined;
  var __portalSql: ReturnType<typeof postgres> | undefined;
}

export function isEmbeddedUrl(url: string): boolean {
  return url.startsWith("pglite:");
}

/** "pglite://./.pglite" -> "./.pglite" */
export function embeddedPath(url: string): string {
  return url.replace(/^pglite:(\/\/)?/, "") || "./.pglite";
}

function createDatabase(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a Postgres connection string.",
    );
  }

  if (isEmbeddedUrl(url)) {
    // Required lazily so the WASM build is never pulled into a production
    // bundle: this branch cannot run when DATABASE_URL is a real server.
    const require = createRequire(import.meta.url);
    const { PGlite } = require("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = require("drizzle-orm/pglite");

    const client = new PGlite(embeddedPath(url));

    // The two drivers expose the same query builder; only the session differs.
    return drizzlePglite(client, {
      schema,
      casing: "snake_case",
    }) as unknown as PostgresJsDatabase<typeof schema>;
  }

  const client = postgres(url, {
    // Serverless functions are short lived; a small pool avoids exhausting
    // the database while still allowing a little concurrency per instance.
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // required when running behind a transaction pooler
  });

  if (process.env.NODE_ENV !== "production") globalThis.__portalSql = client;

  return drizzle(client, { schema, casing: "snake_case" });
}

const database = globalThis.__portalDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalThis.__portalDb = database;

export const db = database;

export type Database = typeof db;

/**
 * The transaction type, exported so services can accept either the root client
 * or an open transaction. Workflows that must not partially apply take this.
 */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Either the pooled client or an in-flight transaction. */
export type DbExecutor = Database | Transaction;

export { schema };

/**
 * Normalises the result of a raw `execute`.
 *
 * postgres.js returns the rows directly; PGlite returns `{ rows }`. Anything
 * running raw SQL goes through here so it behaves the same on both drivers.
 */
export async function executeRows<T>(
  executor: DbExecutor,
  query: Parameters<DbExecutor["execute"]>[0],
): Promise<T[]> {
  const result = (await executor.execute(query)) as unknown;

  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}
