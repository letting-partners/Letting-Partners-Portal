import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Node 20 test runner does not discover TypeScript files when given a
 * directory, so it exits 0 having run nothing. That would make `npm test` a
 * silent pass. This collects the files explicitly and fails loudly if none
 * are found.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = path.join(root, "tests");

function collect(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.name.endsWith(".test.ts") ? [full] : [];
  });
}

const files = collect(testsDir);

if (files.length === 0) {
  console.error("No test files found under tests/. Refusing to report success.");
  process.exit(1);
}

console.log(`Running ${files.length} test file${files.length === 1 ? "" : "s"}...`);

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
