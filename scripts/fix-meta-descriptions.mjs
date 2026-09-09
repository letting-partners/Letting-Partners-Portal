import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Repairs meta descriptions that were cut mid-word.
 *
 * The old generator sliced at exactly 152 characters and appended "...", which
 * produced endings like "the property featu...". Only rows with that signature
 * are touched: a description an agent wrote themselves does not end that way,
 * and rewriting one would throw away their words.
 *
 *   node scripts/fix-meta-descriptions.mjs          show what would change
 *   node scripts/fix-meta-descriptions.mjs --apply  write it
 */

const apply = process.argv.includes("--apply");
const MAX = 160;

/** Same rule as services/listing-seo.ts. */
function truncateAtWord(value, max, ellipsis = false) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const limit = ellipsis ? max - 1 : max;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "");
  return ellipsis ? `${trimmed}…` : trimmed;
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const rows = await sql`
  select id, reference, description, meta_description
  from properties
  where meta_description like ${"%..."} and description is not null and deleted_at is null
`;

if (rows.length === 0) {
  console.log("\nNothing to repair.\n");
  await sql.end();
  process.exit(0);
}

console.log("");
let changed = 0;

for (const row of rows) {
  const next = truncateAtWord(row.description, MAX, true);
  if (next === row.meta_description) continue;

  changed += 1;
  console.log(`${row.reference}`);
  console.log(`  was: ${row.meta_description}`);
  console.log(`  now: ${next}\n`);

  if (apply) {
    await sql`update properties set meta_description = ${next}, updated_at = now() where id = ${row.id}`;
  }
}

console.log(
  apply ? `${changed} repaired.\n` : `${changed} would be repaired. Re-run with --apply.\n`,
);

await sql.end();
