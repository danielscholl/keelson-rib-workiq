// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}

// Locate a `workiq` executable on PATH, including Windows PATHEXT shims
// (`workiq.cmd`). A bare-name return lets the transport's cross-spawn resolve
// it; null means no global install exists and the caller falls back to npx.
function findWorkiqOnPath(): string | null {
  const pathVar = process.env.PATH ?? process.env.Path ?? "";
  const names =
    process.platform === "win32"
      ? ["workiq.cmd", "workiq.exe", "workiq.bat", "workiq"]
      : ["workiq"];
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      if (existsSync(join(dir, name))) return "workiq";
    }
  }
  return null;
}

// The upstream MCP server to bridge. Resolution order:
//   1. KEELSON_WORKIQ_COMMAND (+ optional KEELSON_WORKIQ_ARGS) — explicit override.
//   2. KEELSON_WORKIQ_ARGS alone — passed to `npx`.
//   3. A globally-installed `workiq` binary on PATH — launched directly.
//   4. `npx -y @microsoft/workiq mcp` — cold-cache fallback.
// A direct binary launch (3) is preferred because `npx` performs a per-launch
// registry check that hangs on a slow/TLS-inspected npm registry — and the old
// `@latest` pin forced that network round-trip on every start. Dropping `@latest`
// from the fallback lets a cached package launch offline; only a cold cache pays
// the one-time fetch. Install once with `npm install -g @microsoft/workiq`.
function resolveLaunch(): { command: string; args: string[] } {
  const commandEnv = process.env.KEELSON_WORKIQ_COMMAND?.trim();
  const argsEnv = process.env.KEELSON_WORKIQ_ARGS?.trim();
  if (commandEnv) {
    return { command: commandEnv, args: argsEnv ? argsEnv.split(/\s+/) : ["mcp"] };
  }
  if (argsEnv) {
    return { command: "npx", args: argsEnv.split(/\s+/) };
  }
  const onPath = findWorkiqOnPath();
  if (onPath) return { command: onPath, args: ["mcp"] };
  return { command: "npx", args: ["-y", "@microsoft/workiq", "mcp"] };
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Full inherited environment so the WorkIQ child sees the operator's auth/token
// vars. On Windows the search path arrives as `Path`; a bare command spawned
// with an explicit env resolves against `PATH`, so mirror it (matches keelson's
// ensureSpawnPath convention) or `workiq`/`npx` can ENOENT.
function inheritedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
  if (process.platform === "win32" && env.PATH === undefined) {
    for (const key of Object.keys(env)) {
      if (key.toUpperCase() === "PATH") {
        env.PATH = env[key] as string;
        break;
      }
    }
  }
  return env;
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// A single stdio MCP client to the WorkIQ server, reused for the server's
// lifetime. `connect` is idempotent and coalesces concurrent callers so one
// child process backs every tool call.
export class WorkIqMcpClient {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.client) return;
    if (!this.connecting) {
      this.connecting = this.doConnect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  private async doConnect(): Promise<void> {
    const { command, args } = resolveLaunch();
    const debug = process.env.KEELSON_WORKIQ_DEBUG === "1";
    const transport = new StdioClientTransport({
      command,
      args,
      env: inheritedEnv(),
      stderr: debug ? "inherit" : "ignore",
    });
    const client = new Client(
      { name: "keelson-rib-workiq", version: "0.1.0" },
      { capabilities: {} },
    );
    const timeoutMs = intEnv("KEELSON_WORKIQ_CONNECT_TIMEOUT_MS", 60000);
    await withTimeout(
      client.connect(transport),
      timeoutMs,
      `WorkIQ MCP connect timed out after ${timeoutMs}ms`,
    );
    this.client = client;
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.client) throw new Error("WorkIQ MCP client not connected");
    const res = await this.client.listTools();
    return (res.tools ?? []) as McpTool[];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.client) await this.connect();
    if (!this.client) throw new Error("WorkIQ MCP client unavailable");
    const timeoutMs = intEnv("KEELSON_WORKIQ_CALL_TIMEOUT_MS", 120000);
    return this.client.callTool(
      { name, arguments: args },
      undefined,
      { timeout: timeoutMs, ...(signal ? { signal } : {}) },
    );
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client) {
      try {
        await client.close();
      } catch {
        // Best-effort teardown; a dead child is already gone.
      }
    }
  }
}
