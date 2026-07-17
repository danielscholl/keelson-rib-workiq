#!/usr/bin/env node
// Guards the docs against the drift class a build alone does not catch: the rib
// grows an env var, an intent-flagged tool, or a module and the docs keep
// describing the old set. Derives every set from the rib source rather than a
// hardcoded list, so adding one fails this check until the docs mention it.
// Run after `astro build`, against docs/dist/llms-full.txt and the rib's src/.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(scriptDir, "..");
const repoRoot = join(docsDir, "..");
const distLlms = join(docsDir, "dist", "llms-full.txt");
const contentDir = join(docsDir, "src", "content", "docs");
const srcDir = join(repoRoot, "src");

const failures = [];
const fail = (msg) => failures.push(msg);

// --- gather inputs -----------------------------------------------------------

if (!existsSync(distLlms)) {
  console.error(
    `check-docs-drift: ${relative(repoRoot, distLlms)} missing — run \`bun run build\` first.`,
  );
  process.exit(1);
}
const llms = readFileSync(distLlms, "utf8");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(mdx?|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const sourceDocs = walk(contentDir).filter((f) => /\.mdx?$/.test(f));
const srcFiles = walk(srcDir).filter((f) => f.endsWith(".ts"));
const src = srcFiles.map((f) => readFileSync(f, "utf8")).join("\n");

const uniq = (matches) => [...new Set(matches)];
const matchAll = (text, re) => uniq([...text.matchAll(re)].map((m) => m[1]));

// --- 1. obsolete terms (source pages + generated output) ---------------------

// Names that were renamed or never shipped. A hit means a page is describing a
// rib that does not exist.
const FORBIDDEN = [
  [
    /@microsoft\/workiq@latest/,
    'obsolete launch "@microsoft/workiq@latest" (the fallback dropped the @latest pin)',
  ],
];

function scanLines(label, text) {
  const lines = text.split("\n");
  for (const [re, msg] of FORBIDDEN) {
    lines.forEach((line, i) => {
      if (re.test(line)) fail(`${label}:${i + 1}: ${msg} — ${line.trim()}`);
    });
  }
}
for (const file of sourceDocs) scanLines(relative(repoRoot, file), readFileSync(file, "utf8"));
scanLines("dist/llms-full.txt", llms);

// --- 2. documented sets match the source ------------------------------------

// Env vars: every KEELSON_WORKIQ_* the rib reads.
const envVars = matchAll(src, /\b(KEELSON_WORKIQ_[A-Z_]+)\b/g);
for (const v of envVars) {
  if (!llms.includes(v)) fail(`env var "${v}" is read in src/ but is not documented.`);
}

// Intent-flagged tools: every name in bridge.ts's MUTATING / CONFIRM sets must
// be documented as its bridged workiq_ name, since these drive the harness
// gates. Scoped to the Set literals so unrelated strings never false-positive.
const bridge = readFileSync(join(srcDir, "bridge.ts"), "utf8");
const setLiterals = [...bridge.matchAll(/new Set\(\[([^\]]*)\]\)/gs)].map((m) => m[1]).join(",");
const flagged = matchAll(setLiterals, /"([a-z_]+)"/g);
for (const name of flagged) {
  if (!llms.includes(`workiq_${name}`)) {
    fail(`intent-flagged tool "${name}" is named in src/bridge.ts but "workiq_${name}" is not documented.`);
  }
}

// Modules: the docs teach the three-module construction; a rename or a new
// module must reach the docs.
const modules = srcFiles.map((f) => relative(repoRoot, f));
for (const m of modules) {
  if (!llms.includes(m)) fail(`module "${m}" exists but is not mentioned in the docs.`);
}

// Static workflows: every YAML the rib ships in workflows/ is discovered by the
// harness and merged into its catalog under the file's `name:`. A shipped-but-
// undocumented workflow drifts the same way an env var or a flagged tool does,
// so require each catalog name to appear in the generated corpus.
const workflowsDir = join(repoRoot, "workflows");
const workflowNames = [];
try {
  for (const entry of readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const text = readFileSync(join(workflowsDir, entry), "utf8");
    const name = /^name:\s*(\S+)\s*$/m.exec(text)?.[1];
    if (name) workflowNames.push(name);
  }
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}
for (const name of workflowNames) {
  if (!llms.includes(name)) {
    fail(`workflow "${name}" ships in workflows/ but is not documented.`);
  }
}

// --- report ------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\ncheck-docs-drift: ${failures.length} issue(s) found:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log(
  `check-docs-drift: ok (${sourceDocs.length} source pages; ${envVars.length} env vars, ${flagged.length} flagged tools, ${modules.length} modules, ${workflowNames.length} workflows cross-checked against the generated corpus).`,
);
