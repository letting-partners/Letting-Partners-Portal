import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Empties the portal of demo records, leaving a working installation with one
 * super admin and nothing else.
 *
 *   node scripts/reset-demo-data.mjs                 report only
 *   node scripts/reset-demo-data.mjs --yes           actually delete
 *   node scripts/reset-demo-data.mjs --yes --keep other@example.com
 *
 * Configuration is not demo data and is kept: company details, the default
 * commission rates and the exchange rate. So are the kept user's live session
 * and any sign-in code they have just requested, so this does not log them out
 * mid-reset. Reference numbers restart at 1.
 *
 * This is irreversible. There is no undo and no backup taken here.
 */

const confirmed = process.argv.includes("--yes");
const keepIndex = process.argv.indexOf("--keep");
const keepEmail = (keepIndex === -1 ? "admin@lettingpartners.co.uk" : process.argv[keepIndex + 1]).toLowerCase();

/** Every table holding operational records. Emptied completely. */
const DEMO_TABLES = [
  "activities",
  "agent_fronter_assignments",
  "audit_log",
  "calls",
  "closings",
  "collaboration_participants",
  "collaborations",
  "commissions",
  "cross_sell_splits",
  "customer_conversation_events",
  "customer_conversations",
  "customer_messages",
  "deal_stage_history",
  "deals",
  "follow_ups",
  "image_assets",
  "internal_conversation_participants",
  "internal_conversations",
  "internal_messages",
  "landlord_ownership_history",
  "landlords",
  "not_interested_records",
  "notes",
  "notifications",
  "properties",
  "property_history",
  "property_images",
  "property_publications",
  "property_rooms",
  "sales",
  "tenants",
  "user_commission_rules",
  "user_presence",
  "verifications",
  "viewings",
];

/** Kept because the portal needs them to work, not because they are demo. */
const CONFIG_TABLES = ["system_settings", "commission_rules", "exchange_rates"];

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const [keeper] = await sql`
  select id, email, full_name, role from users where lower(email) = ${keepEmail} limit 1
`;

if (!keeper) {
  console.error(`\nNo user ${keepEmail}. Refusing to empty the database with no way back in.\n`);
  await sql.end();
  process.exit(1);
}

async function countOf(table) {
  const [row] = await sql.unsafe(`select count(*)::int as count from "${table}"`);
  return row.count;
}

const before = {};
for (const table of [...DEMO_TABLES, ...CONFIG_TABLES, "users", "sessions", "otp_codes", "rate_limits"]) {
  before[table] = await countOf(table);
}

const doomed = DEMO_TABLES.filter((table) => before[table] > 0);
const otherUsers = await sql`
  select email, role from users where id <> ${keeper.id} order by email
`;

console.log(`\nKeeping ${keeper.full_name} <${keeper.email}> (${keeper.role})`);

console.log(`\nWill delete ${otherUsers.length} other user${otherUsers.length === 1 ? "" : "s"}:`);
for (const user of otherUsers) console.log(`  ${user.email}  ${user.role}`);

console.log(`\nWill empty ${doomed.length} table${doomed.length === 1 ? "" : "s"} holding records:`);
for (const table of doomed) console.log(`  ${String(before[table]).padStart(5)}  ${table}`);

console.log("\nWill keep configuration:");
for (const table of CONFIG_TABLES) console.log(`  ${String(before[table]).padStart(5)}  ${table}`);

if (!confirmed) {
  console.log("\nReport only. Re-run with --yes to delete.\n");
  await sql.end();
  process.exit(0);
}

await sql.begin(async (tx) => {
  const list = DEMO_TABLES.map((table) => `"${table}"`).join(", ");
  await tx.unsafe(`truncate table ${list} restart identity cascade`);

  // Sessions and codes belonging to anyone else go with them; the kept user
  // stays signed in and any code they just requested still works.
  await tx`delete from sessions where user_id <> ${keeper.id}`;
  await tx`delete from otp_codes where lower(email) <> ${keeper.email.toLowerCase()}`;
  await tx`delete from users where id <> ${keeper.id}`;

  // Transient counters, including any block from a mistyped address.
  await tx`delete from rate_limits`;

  // Reference numbers start again from 1.
  await tx`alter sequence property_reference_seq restart with 1`;
  await tx`alter sequence sale_reference_seq restart with 1`;
});

/* ------------------------------------------------------------- verify */

console.log("\nAfter:");
let problems = 0;

for (const table of DEMO_TABLES) {
  const count = await countOf(table);
  if (count !== 0) {
    problems += 1;
    console.log(`  FAIL  ${table} still has ${count} row(s)`);
  }
}

for (const table of CONFIG_TABLES) {
  const count = await countOf(table);
  if (count !== before[table]) {
    problems += 1;
    console.log(`  FAIL  ${table} went from ${before[table]} to ${count} - config was lost`);
  } else {
    console.log(`  ok    ${table} kept ${count} row(s)`);
  }
}

const users = await countOf("users");
if (users !== 1) {
  problems += 1;
  console.log(`  FAIL  users has ${users} rows, expected 1`);
} else {
  console.log(`  ok    users kept 1 row (${keeper.email})`);
}

const sessions = await countOf("sessions");
console.log(`  ok    sessions kept ${sessions} (the kept user stays signed in)`);

console.log(
  problems === 0
    ? "\nPortal is empty apart from the super admin and its configuration.\n"
    : `\n${problems} problem(s) - inspect before using this installation.\n`,
);

await sql.end();
process.exit(problems === 0 ? 0 : 1);
