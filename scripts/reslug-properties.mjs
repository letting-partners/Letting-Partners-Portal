import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Rebuilds public property URLs from the listing title.
 *
 * Slugs used to carry the reference and the structured fields, giving URLs
 * like /properties/house-newham-e7-lp-0003. The reference means nothing to
 * anyone outside the office, so new listings now slug from the title alone.
 * This brings the ones already published into line.
 *
 * A slug is normally kept for life, because changing it breaks a link that has
 * been shared or indexed. That is worth doing once, this early, and not again.
 *
 *   node scripts/reslug-properties.mjs          show what would change
 *   node scripts/reslug-properties.mjs --apply  write it
 */

const apply = process.argv.includes("--apply");

function slugify(input) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const rows = await sql`
  select id, reference, title, slug
  from properties
  where slug is not null and deleted_at is null
  order by reference
`;

const taken = new Set(rows.map((row) => row.slug));
let changed = 0;
console.log("");

for (const row of rows) {
  if (!row.title) {
    console.log(`  skip    ${row.reference} (no title to slug from)`);
    continue;
  }

  const base = slugify(row.title);
  if (!base || base === row.slug) continue;

  // Never collide with a slug another property already holds.
  let next = base;
  let counter = 2;
  while (taken.has(next)) {
    next = `${base}-${counter}`;
    counter += 1;
  }

  changed += 1;
  taken.delete(row.slug);
  taken.add(next);

  console.log(`  ${row.reference}`);
  console.log(`    was: /properties/${row.slug}`);
  console.log(`    now: /properties/${next}\n`);

  if (apply) {
    await sql`update properties set slug = ${next}, updated_at = now() where id = ${row.id}`;
  }
}

console.log(
  changed === 0
    ? "Nothing to change.\n"
    : apply
      ? `${changed} updated. The old URLs stop working, so resubmit the sitemap.\n`
      : `${changed} would change. Re-run with --apply.\n`,
);

await sql.end();
