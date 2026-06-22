import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync, statSync } from "node:fs";

const isWindows = process.platform === "win32";
const npxCmd = "npx";
const prismaEnginePattern = /^(schema-engine|migration-engine|query-engine|prisma-fmt)(?:-|$)/;

function runPrisma(args, { allowFailure = false } = {}) {
  const result = spawnSync(npxCmd, ["prisma", ...args], {
    encoding: "utf8",
    shell: isWindows,
    stdio: "pipe",
    windowsHide: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) throw result.error;
  const exitCode = result.status ?? 1;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (exitCode !== 0 && !allowFailure) {
    const error = new Error(`prisma ${args.join(" ")} failed with exit code ${exitCode}`);
    error.output = output;
    throw error;
  }

  return { exitCode, output };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensurePrismaEnginesExecutable() {
  if (process.platform === "win32") return;

  const enginesDir = new URL("../node_modules/@prisma/engines/", import.meta.url);
  if (!existsSync(enginesDir)) return;

  let updated = 0;
  for (const entry of readdirSync(enginesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !prismaEnginePattern.test(entry.name)) continue;

    const engineFile = new URL(entry.name, enginesDir);
    const mode = statSync(engineFile).mode & 0o777;
    if ((mode & 0o111) === 0o111) continue;

    chmodSync(engineFile, mode | 0o755);
    updated += 1;
  }

  if (updated > 0) {
    process.stdout.write(`[migrate] Fixed executable permissions on ${updated} Prisma engine file(s).\n`);
  }
}

// Neon pooled connections don't support advisory locks required by Prisma Migrate.
// Override DATABASE_URL with the direct (non-pooled) URL for migrations.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
  process.stdout.write("[migrate] Using DIRECT_URL for migrations (non-pooled connection).\n");
}

ensurePrismaEnginesExecutable();

const retriesRaw = Number.parseInt(process.env.PRISMA_MIGRATE_DEPLOY_RETRIES ?? "5", 10);
const delayRaw = Number.parseInt(process.env.PRISMA_MIGRATE_DEPLOY_DELAY_MS ?? "15000", 10);
const maxRetries = Number.isFinite(retriesRaw) && retriesRaw > 0 ? retriesRaw : 5;
const retryDelayMs = Number.isFinite(delayRaw) && delayRaw > 0 ? delayRaw : 15000;

for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
  const { exitCode, output } = runPrisma(["migrate", "deploy"], { allowFailure: true });
  if (exitCode === 0) {
    process.stdout.write(`[migrate] prisma migrate deploy succeeded on attempt ${attempt}/${maxRetries}.\n`);
    process.exit(0);
  }

  const retryable = /\bP1002\b/i.test(output) || /advisory lock/i.test(output) || /timed out/i.test(output);
  if (!retryable || attempt === maxRetries) {
    process.stderr.write(`[migrate] prisma migrate deploy failed on attempt ${attempt}/${maxRetries}.\n`);
    process.exit(exitCode);
  }

  process.stderr.write(
    `[migrate] advisory lock timeout (attempt ${attempt}/${maxRetries}); retrying in ${retryDelayMs}ms...\n`,
  );
  await sleep(retryDelayMs);
}
