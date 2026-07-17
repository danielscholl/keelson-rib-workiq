import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIRM, MUTATING } from "../src/bridge.ts";

// The rib ships static YAML workflows in workflows/; keelson discovers, parses,
// and validates each against its own loader at boot. That loader owns schema
// validity, so these tests guard only what the rib itself is responsible for —
// no YAML parser, no keelson import, no spawning. Full schema validation runs in
// the harness at boot (a broken file surfaces as a catalog notice).
const WORKFLOWS_DIR = join(import.meta.dir, "..", "workflows");

// Runs at test-definition time, so a missing or unreadable workflows/ folder
// must yield an empty list — the "ships the briefing workflow" test then fails
// with a clear assertion instead of the suite crashing at module evaluation.
function workflowFiles(): string[] {
  try {
    return readdirSync(WORKFLOWS_DIR).filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"));
  } catch {
    return [];
  }
}

// Every tool named across the file's `allowed_tools` opt-in lists, in either
// flow style (`[a, b]`) or block style (`- a`), so a formatting-only YAML edit
// cannot fail the suite.
function allowedTools(yaml: string): string[] {
  const tools: string[] = [];
  const push = (raw: string) => {
    const name = raw.trim().replace(/^["']|["']$/g, "");
    if (name) tools.push(name);
  };
  for (const match of yaml.matchAll(/allowed_tools:\s*\[([^\]]*)\]/g)) {
    for (const raw of (match[1] ?? "").split(",")) push(raw);
  }
  for (const match of yaml.matchAll(/allowed_tools:\s*\n((?:[ \t]+-[^\n]*\n?)+)/g)) {
    for (const line of (match[1] ?? "").split("\n")) {
      const item = /^[ \t]+-\s*(.+)$/.exec(line)?.[1];
      if (item) push(item);
    }
  }
  return tools;
}

describe("shipped static workflows", () => {
  test("the rib ships the briefing workflow", () => {
    expect(workflowFiles()).toContain("workiq-briefing.yaml");
  });

  for (const file of workflowFiles()) {
    // Read inside each test so an unreadable file fails that test with a clear
    // message instead of erroring the whole suite at module evaluation.
    const readYaml = () => readFileSync(join(WORKFLOWS_DIR, file), "utf8");

    // A rib workflow's `name` is its catalog key; a global workflow of the same
    // name would shadow it, so namespace under `workiq-` and match the filename.
    test(`${file}: name is workiq-namespaced and matches the filename`, () => {
      const name = /^name:\s*(\S+)\s*$/m.exec(readYaml())?.[1]?.replace(/^["']|["']$/g, "");
      expect(name).toBe(file.replace(/\.ya?ml$/, ""));
      expect(name).toMatch(/^workiq-/);
    });

    // The bridge's "reads freely, confirm before writing" posture reaches the
    // workflow layer: a shipped workflow opts into the read path and never
    // grants itself a mutating verb bridge.ts flags state_changing, nor a
    // consent-demanding one it flags requires_confirmation — a workflow run has
    // no user present to answer the confirmation.
    test(`${file}: opts into read-only workiq tools only`, () => {
      const workiqTools = allowedTools(readYaml()).filter((t) => t.startsWith("workiq_"));
      expect(workiqTools.length).toBeGreaterThan(0);
      const gated = workiqTools.filter((t) => {
        const name = t.slice("workiq_".length);
        return MUTATING.has(name) || CONFIRM.has(name);
      });
      expect(gated).toEqual([]);
    });
  }
});
