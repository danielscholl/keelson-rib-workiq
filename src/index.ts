// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import type { Rib, ToolDefinition } from "@keelson/shared";
import { toKeelsonTool } from "./bridge";
import { WorkIqMcpClient } from "./mcp-client";

const client = new WorkIqMcpClient();

// registerTools is synchronous, so discover the WorkIQ tool set once at rib
// load — top-level await — and cache it. A failed handshake costs this boot its
// WorkIQ tools, not the harness: the catch below is the fail-soft boundary, and
// the connection reopens on the next server start.
//
// Tests import this module to assert the rib's shape; `bun test` sets
// NODE_ENV=test, and skipping discovery there keeps a test run from ever
// spawning a WorkIQ child.
let tools: readonly ToolDefinition[] = [];
if (process.env.NODE_ENV !== "test") {
  try {
    await client.connect();
    const discovered = await client.listTools();
    tools = discovered.map((mcp) =>
      toKeelsonTool(mcp, (name, args, signal) => client.callTool(name, args, signal)),
    );
    console.log(`[keelson] rib 'workiq' bridged ${tools.length} WorkIQ tool(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[keelson] rib 'workiq' could not reach WorkIQ (${message}); registering no tools this boot`,
    );
    await client.close();
  }
}

const rib: Rib = {
  id: "workiq",
  displayName: "WorkIQ",
  registerTools: () => tools,
  // The published docs corpus, indexed by the harness's keelson_docs tool so an
  // installed rib extends what the agent can look up about itself.
  contributeDocs: () => [
    {
      title: "WorkIQ",
      summary:
        "The WorkIQ rib for Keelson: Microsoft 365 Copilot and Graph bridged as chat tools. Covers the bridge pipeline, guardrails, install and local-dev guides, the write-your-own-rib tutorial, and the rib's design decisions.",
      llmsFullUrl: "https://danielscholl.github.io/keelson-rib-workiq/llms-full.txt",
    },
  ],
  async dispose(): Promise<void> {
    await client.close();
  },
};

export default rib;
