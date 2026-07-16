// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rib, ToolContext, ToolDefinition } from "@keelson/shared";
import { inputSchemaToZod, serializeToolResult } from "./json-schema";
import { type McpTool, WorkIqMcpClient } from "./mcp-client";

// WorkIQ marks `accept_eula` destructive via annotations; the rest of the
// write path has no machine-readable hint, so name-match the mutating verbs.
const MUTATING = new Set([
  "create_entity",
  "update_entity",
  "delete_entity",
  "do_action",
  "accept_eula",
]);
// Tools whose own descriptions demand explicit user consent before running.
const CONFIRM = new Set(["accept_eula", "get_debug_link"]);

const client = new WorkIqMcpClient();

function toKeelsonTool(mcp: McpTool): ToolDefinition {
  const remoteName = mcp.name;
  const destructive = (mcp.annotations ?? {}).destructiveHint === true;
  return {
    // `workiq_` prefix so the tool buckets under the `workiq` family in /api/tools.
    name: `workiq_${remoteName}`,
    description: mcp.description ?? `WorkIQ ${remoteName}`,
    inputSchema: inputSchemaToZod(mcp.inputSchema),
    state_changing: destructive || MUTATING.has(remoteName),
    requires_confirmation: CONFIRM.has(remoteName),
    async execute(input: unknown, ctx: ToolContext): Promise<void> {
      try {
        const args = (input ?? {}) as Record<string, unknown>;
        const result = await client.callTool(remoteName, args, ctx.abortSignal);
        const { content, isError } = serializeToolResult(result);
        ctx.emit({
          type: "tool_result",
          toolUseId: "",
          content,
          ...(isError ? { isError: true } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.emit({
          type: "tool_result",
          toolUseId: "",
          content: `WorkIQ ${remoteName} failed: ${message}`,
          isError: true,
        });
      }
    },
  };
}

// registerTools is synchronous, so discover the WorkIQ tool set once at rib
// load and cache it. A failed handshake costs this boot its WorkIQ tools, not
// the harness — the connection reopens on the next server start.
let tools: readonly ToolDefinition[] = [];
try {
  await client.connect();
  tools = (await client.listTools()).map(toKeelsonTool);
  console.log(`[keelson] rib 'workiq' bridged ${tools.length} WorkIQ tool(s)`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(
    `[keelson] rib 'workiq' could not reach WorkIQ (${message}); registering no tools this boot`,
  );
  await client.close();
}

const rib: Rib = {
  id: "workiq",
  displayName: "WorkIQ",
  registerTools: () => tools,
  async dispose(): Promise<void> {
    await client.close();
  },
};

export default rib;
