import { describe, expect, test } from "bun:test";
import type { RibContext } from "@keelson/shared";
// Importing the rib runs its module top-level. Under bun test NODE_ENV=test,
// so boot discovery is skipped — this import must never spawn a WorkIQ child.
import rib from "../src/index.ts";

describe("the rib's contract surface", () => {
  test("identity matches the package basename convention", () => {
    expect(rib.id).toBe("workiq");
    expect(rib.displayName).toBe("WorkIQ");
  });

  test("registerTools returns the discovered set — empty in a test boot", () => {
    const tools = rib.registerTools?.({} as RibContext) ?? [];
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toHaveLength(0);
  });

  test("dispose tears down cleanly even when nothing connected", async () => {
    await expect(Promise.resolve(rib.dispose?.())).resolves.toBeUndefined();
  });
});
