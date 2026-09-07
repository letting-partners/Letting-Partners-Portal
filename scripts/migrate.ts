import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Applies pending migrations.
 *
 * Handles both drivers: a real Postgres server, or the embedded PGlite build
 * used for local development (see db/index.ts).
 */

const MIGRATIONS_FOLDER = "./db/migrations";

async function migrateEmbedded(url: string) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");

  const path = url.replace(/^pglite:(\/\/)?/, "") || "./.pglite";
  console.log(`Applying migrations to the embedded database at ${path} ...`);

  const client = new PGlite(path);
  const db = drizzlePglite(client);

  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await client.close();
}

async function migrateServer(url: string) {
  // A dedicated single connection: migrations must not share the app pool.
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 30 });
  const db = drizzle(client);

  console.log("Applying migrations from ./db/migrations ...");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await client.end();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to portal/.env.local first.");
    process.exit(1);
  }

  if (url.startsWith("pglite:")) await migrateEmbedded(url);
  else await migrateServer(url);

  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error("Migration failed:");
  console.error(error);
  process.exit(1);
});
