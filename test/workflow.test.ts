import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MUTATING } from "../src/bridge.ts";

// The rib ships static YAML workflows in workflows/; keelson discovers, parses,
// and validates each against its own loader at boot. That loader owns schema
// validity, so these tests guard only what the rib itself is responsible for —
// no YAML parser, no keelson import, no spawning. Full schema validation runs in
// the harness at boot (a broken file surfaces as a catalog notice).
const WORKFLOWS_DIR = join(import.meta.dir, "..", "workflows");

function workflowFiles(): string[] {
  return readdirSync(WORKFLOWS_DIR).filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"));
}

// Every tool named across the file's `allowed_tools: [a, b]` opt-in lists.
function allowedTools(yaml: string): string[] {
  const tools: string[] = [];
  for (const match of yaml.matchAll(/allowed_tools:\s*\[([^\]]*)\]/g)) {
    for (const raw of (match[1] ?? "").split(",")) {
      const name = raw.trim().replace(/^["']|["']$/g, "");
      if (name) tools.push(name);
    }
  }
  return tools;
}

describe("shipped static workflows", () => {
  test("the rib ships the briefing workflow", () => {
    expect(workflowFiles()).toContain("workiq-briefing.yaml");
  });

  for (const file of workflowFiles()) {
    const yaml = readFileSync(join(WORKFLOWS_DIR, file), "utf8");

    // A rib workflow's `name` is its catalog key; a global workflow of the same
    // name would shadow it, so namespace under `workiq-` and match the filename.
    test(`${file}: name is workiq-namespaced and matches the filename`, () => {
      const name = /^name:\s*(\S+)\s*$/m.exec(yaml)?.[1];
      expect(name).toBe(file.replace(/\.ya?ml$/, ""));
      expect(name).toMatch(/^workiq-/);
    });

    // The bridge's "reads freely, confirm before writing" posture reaches the
    // workflow layer: a shipped workflow opts into the read path and never
    // grants itself one of the mutating verbs bridge.ts flags state_changing.
    test(`${file}: opts into read-only workiq tools only`, () => {
      const workiqTools = allowedTools(yaml).filter((t) => t.startsWith("workiq_"));
      expect(workiqTools.length).toBeGreaterThan(0);
      const mutating = workiqTools.filter((t) => MUTATING.has(t.slice("workiq_".length)));
      expect(mutating).toEqual([]);
    });
  }
});
