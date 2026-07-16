// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}

// The upstream MCP server to bridge. Defaults to the published WorkIQ package via
// npx. On a slow/inspected npm registry, point KEELSON_WORKIQ_ARGS at a
// cache-only launch (`-y --offline @microsoft/workiq mcp`) after a one-time
// `npm install -g @microsoft/workiq` to avoid the per-launch registry check.
function resolveLaunch(): { command: string; args: string[] } {
  const command = process.env.KEELSON_WORKIQ_COMMAND?.trim() || "npx";
  const argsEnv = process.env.KEELSON_WORKIQ_ARGS?.trim();
  const args = argsEnv ? argsEnv.split(/\s+/) : ["-y", "@microsoft/workiq@latest", "mcp"];
  return { command, args };
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function inheritedEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
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
