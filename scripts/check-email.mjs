import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Why no sign-in code arrived. Two causes look identical from the login form,
 * because the request step deliberately reports success either way rather than
 * revealing which addresses have accounts:
 *
 *   1. the address has no active account, so nothing was ever sent
 *   2. the provider rejected the send, usually an unverified sending domain
 *
 *   node scripts/check-email.mjs [email]
 */

const target = process.argv[2]?.toLowerCase() ?? null;
const key = process.env.RESEND_API_KEY;
const from = process.env.AUTH_FROM_EMAIL ?? "(default)";

console.log(`\nFrom address: ${from}`);

/* ------------------------------------------------------- 1. the account */

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const accounts = await sql`
  select email, full_name, role, status from users order by created_at
`;

console.log(`\nAccounts (${accounts.length}):`);
for (const account of accounts) {
  const flag = account.status === "ACTIVE" ? "ok  " : "OFF ";
  console.log(`  ${flag}  ${account.email}  ${account.role}`);
}

if (target) {
  const match = accounts.find((a) => a.email.toLowerCase() === target);
  if (!match) {
    console.log(
      `\n  ${target} has no account, so no code is ever sent to it.` +
        `\n  The login form still says "code sent" - that is deliberate, so the` +
        `\n  form cannot be used to discover which addresses are staff.`,
    );
  } else if (match.status !== "ACTIVE") {
    console.log(`\n  ${target} exists but is ${match.status}, so no code is sent.`);
  } else {
    console.log(`\n  ${target} is an active account, so a code should be sent.`);
  }
}

/* ------------------------------------------------- 2. did it even try? */

/*
 * A code row is written before the email is sent, so its absence proves the
 * send was never reached. The rate-limit keys record which addresses were
 * actually submitted - including ones with no account, which leave no other
 * trace. Together these separate "the mail failed" from "nobody asked".
 */
const codes = await sql`
  select email, created_at, consumed_at
  from otp_codes order by created_at desc limit 5
`;

const attempts = await sql`
  select key, count, window_started_at from rate_limits
  where key like 'otp:req:email:%' order by window_started_at desc limit 10
`;

console.log(`
Codes generated (${codes.length} most recent):`);
if (codes.length === 0) {
  console.log("  none - no code has ever been generated, so none was ever sent");
} else {
  for (const code of codes) {
    console.log(
      `  ${code.created_at.toISOString()}  ${code.email}` +
        `  ${code.consumed_at ? "used" : "unused"}`,
    );
  }
}

console.log(`
Addresses submitted to the login form (${attempts.length}):`);
if (attempts.length === 0) {
  console.log("  none");
} else {
  for (const attempt of attempts) {
    const address = attempt.key.replace("otp:req:email:", "");
    const known = accounts.some((a) => a.email.toLowerCase() === address);
    console.log(
      `  ${attempt.window_started_at.toISOString()}  ${address}` +
        `  x${attempt.count}${known ? "" : "  <- no account, nothing sent"}`,
    );
  }
}

await sql.end();

/* ------------------------------------------------------ 3. the provider */

if (!key) {
  console.log("\nRESEND_API_KEY is not set: codes print to the server log instead.\n");
  process.exit(0);
}

const fromDomain = from.match(/@([^>\s]+)/)?.[1] ?? null;

const response = await fetch("https://api.resend.com/domains", {
  headers: { authorization: `Bearer ${key}` },
});

if (!response.ok) {
  console.log(`\nResend rejected the API key: HTTP ${response.status}\n`);
  process.exit(1);
}

const { data = [] } = await response.json();

console.log(`\nSending domains on this Resend account (${data.length}):`);
for (const domain of data) {
  const ok = domain.status === "verified";
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${domain.name}  ${domain.status}  ${domain.region ?? ""}`);
}

const owned = data.find((d) => d.name === fromDomain);

if (!owned) {
  console.log(
    `\n  ${fromDomain} is not on this Resend account, so every send is rejected.` +
      `\n  Add it at resend.com/domains and publish the DNS records it gives you,` +
      `\n  or set AUTH_FROM_EMAIL to an address on a domain that is verified.`,
  );
} else if (owned.status !== "verified") {
  console.log(
    `\n  ${fromDomain} is ${owned.status}, not verified, so sends are rejected.` +
      `\n  Publish the DKIM and SPF records from resend.com/domains, then press` +
      `\n  Verify. DNS can take a few minutes to propagate.`,
  );
} else {
  console.log(`\n  ${fromDomain} is verified, so the provider will accept sends.`);
}

console.log("");
