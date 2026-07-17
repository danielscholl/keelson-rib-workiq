import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveLaunch } from "../src/mcp-client.ts";

const ENV_KEYS = ["KEELSON_WORKIQ_COMMAND", "KEELSON_WORKIQ_ARGS", "PATH"] as const;
let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  delete process.env.KEELSON_WORKIQ_COMMAND;
  delete process.env.KEELSON_WORKIQ_ARGS;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveLaunch", () => {
  test("an explicit command wins, with `mcp` as the default arg", () => {
    process.env.KEELSON_WORKIQ_COMMAND = "/opt/workiq/bin/workiq";
    expect(resolveLaunch()).toEqual({ command: "/opt/workiq/bin/workiq", args: ["mcp"] });
  });

  test("an explicit command takes its args from KEELSON_WORKIQ_ARGS", () => {
    process.env.KEELSON_WORKIQ_COMMAND = "workiq-canary";
    process.env.KEELSON_WORKIQ_ARGS = "mcp --verbose";
    expect(resolveLaunch()).toEqual({ command: "workiq-canary", args: ["mcp", "--verbose"] });
  });

  test("args alone route through npx", () => {
    process.env.KEELSON_WORKIQ_ARGS = "-y @microsoft/workiq@2 mcp";
    expect(resolveLaunch()).toEqual({
      command: "npx",
      args: ["-y", "@microsoft/workiq@2", "mcp"],
    });
  });

  test("a workiq binary on PATH is launched directly", () => {
    const dir = mkdtempSync(join(tmpdir(), "workiq-launch-"));
    try {
      const shim = join(dir, "workiq");
      writeFileSync(shim, "#!/bin/sh\n");
      chmodSync(shim, 0o755);
      process.env.PATH = dir;
      expect(resolveLaunch()).toEqual({ command: "workiq", args: ["mcp"] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no override and no binary falls back to npx without a version pin", () => {
    process.env.PATH = mkdtempSync(join(tmpdir(), "workiq-empty-"));
    try {
      // No @latest: a warm npx cache must be able to launch offline.
      expect(resolveLaunch()).toEqual({
        command: "npx",
        args: ["-y", "@microsoft/workiq", "mcp"],
      });
    } finally {
      rmSync(process.env.PATH, { recursive: true, force: true });
    }
  });
});
