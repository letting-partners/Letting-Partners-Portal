import { createHash, randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Signs in as each role by writing a session directly, then requests every
 * route and reports the status. This catches runtime query errors that a build
 * cannot, and proves the role gates actually gate.
 *
 *   node scripts/smoke.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3003";
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

/** Routes every signed-in user should reach. */
const COMMON = [
  "/dashboard",
  "/calls",
  "/calls/new",
  "/follow-ups",
  "/not-interested",
  "/landlords",
  "/properties",
  "/properties/new",
  "/notes",
  "/sales",
  "/notifications",
  "/profile",
  "/reports/daily",
  "/chats/internal",
  "/search?q=smith",
];

/** Routes only an agent or admin should reach. */
const AGENT = [
  "/tenants",
  "/viewings",
  "/verifications",
  "/closings",
  "/cross-sell",
  "/collaborations",
  "/chats/customer",
  "/images",
  "/reports/performance",
];

/** Routes only an admin should reach. */
const ADMIN = [
  "/team/users",
  "/team/agents",
  "/team/fronters",
  "/settings",
  "/settings/commissions",
  "/audit",
];

async function sessionFor(email) {
  const [user] = await sql`select id, full_name, role from users where lower(email) = ${email.toLowerCase()} limit 1`;
  if (!user) throw new Error(`no user ${email}`);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${tokenHash}, now() + interval '1 hour')
  `;

  return { token, user };
}

async function check(path, cookie) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie: `lp_portal_session=${cookie}` },
    redirect: "manual",
  });

  const status = response.status;
  const location = response.headers.get("location");

  let detail = "";
  if (status >= 500) {
    const body = await response.text();
    const match = body.match(/Failed query:[\s\S]{0,220}/) ?? body.match(/Error: [^<\n]{0,180}/);
    detail = match ? `\n        ${match[0].replace(/\s+/g, " ").slice(0, 200)}` : "";
  }

  return { path, status, location, detail };
}

async function run(label, email, routes, expectBlocked = []) {
  const { token, user } = await sessionFor(email);
  console.log(`\n=== ${label}: ${user.full_name} (${user.role}) ===`);

  let ok = 0;
  let bad = 0;

  for (const path of routes) {
    const result = await check(path, token);
    if (result.status === 200) {
      ok += 1;
      console.log(`  200  ${path}`);
    } else {
      bad += 1;
      console.log(`  ${result.status}  ${path}${result.detail}`);
    }
  }

  for (const path of expectBlocked) {
    const result = await check(path, token);
    // A blocked route should not render: a redirect or an error page is fine,
    // a 200 is a permission hole.
    if (result.status === 200) {
      bad += 1;
      console.log(`  HOLE 200 ${path}  <- should be blocked for ${user.role}`);
    } else {
      ok += 1;
      console.log(`  ${result.status}  ${path}  (correctly blocked)`);
    }
  }

  return { ok, bad };
}

const results = [];
results.push(await run("Admin", "admin@lettingpartners.co.uk", [...COMMON, ...AGENT, ...ADMIN]));
results.push(await run("Agent", "sarah.khan@lettingpartners.co.uk", [...COMMON, ...AGENT], ADMIN));
results.push(await run("Fronter", "ahmed.raza@lettingpartners.co.uk", COMMON, [...AGENT, ...ADMIN]));

const ok = results.reduce((total, r) => total + r.ok, 0);
const bad = results.reduce((total, r) => total + r.bad, 0);

console.log(`\n${ok} ok, ${bad} problem${bad === 1 ? "" : "s"}\n`);

await sql.end();
process.exit(bad === 0 ? 0 : 1);
