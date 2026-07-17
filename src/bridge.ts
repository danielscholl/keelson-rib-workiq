// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { ToolContext, ToolDefinition } from "@keelson/shared";
import { inputSchemaToZod, serializeToolResult } from "./json-schema";
import type { McpTool } from "./mcp-client";

// WorkIQ marks `accept_eula` destructive via annotations; the rest of the
// write path has no machine-readable hint, so name-match the mutating verbs.
// Intent metadata only — an upstream name missing from these sets still
// bridges, just unflagged, so a new WorkIQ tool never breaks discovery.
export const MUTATING = new Set([
  "create_entity",
  "update_entity",
  "delete_entity",
  "do_action",
  "accept_eula",
]);
// Tools whose own descriptions demand explicit user consent before running.
export const CONFIRM = new Set(["accept_eula", "get_debug_link"]);

// The bridge's only runtime dependency, injected so this module stays pure:
// index.ts passes the live MCP client's callTool; tests pass a fake.
export type CallWorkiq = (
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<unknown>;

// One upstream MCP tool → one keelson ToolDefinition. The interesting part is
// what each field feeds: the name buckets the tool under the `workiq` family in
// /api/tools, the zod schema is what the harness `.parse()`s arguments against,
// and the intent flags drive the harness's UI gates for writes.
export function toKeelsonTool(mcp: McpTool, call: CallWorkiq): ToolDefinition {
  const remoteName = mcp.name;
  const destructive = mcp.annotations?.destructiveHint === true;
  return {
    name: `workiq_${remoteName}`,
    description: mcp.description ?? `WorkIQ ${remoteName}`,
    inputSchema: inputSchemaToZod(mcp.inputSchema),
    state_changing: destructive || MUTATING.has(remoteName),
    requires_confirmation: CONFIRM.has(remoteName),
    async execute(input: unknown, ctx: ToolContext): Promise<void> {
      try {
        const args = (input ?? {}) as Record<string, unknown>;
        const result = await call(remoteName, args, ctx.abortSignal);
        const { content, isError } = serializeToolResult(result);
        ctx.emit({
          type: "tool_result",
          toolUseId: "",
          content,
          ...(isError ? { isError: true } : {}),
        });
      } catch (err) {
        // A tool failure is a result the agent can read and react to, never an
        // exception that escapes into the harness's turn loop.
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
