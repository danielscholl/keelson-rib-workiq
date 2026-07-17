---
title: The bridge pipeline
description: "How every workiq_ tool comes to exist: one boot-time handshake discovers the upstream set, a pure layer converts each schema, and the harness registers the result."
sidebar:
  order: 2
---

Every `workiq_` tool in a keelson chat is produced the same way. One
sentence covers it: at rib load the rib spawns **`workiq mcp`** once as
a stdio child, calls **`tools/list`**, converts each tool's JSON-Schema
input into a **lenient zod schema**, wraps it as a keelson
**`ToolDefinition`** with intent flags, and hands the set to the
harness, which routes every later call back over the same connection.

```text
workiq mcp                       (stdio MCP server, owns its own auth)
   │  spawned once at rib load          src/mcp-client.ts
tools/list  ──►  McpTool[]
   │  one per upstream tool             src/bridge.ts
JSON-Schema inputSchema  ──►  lenient zod schema     src/json-schema.ts
   │  + intent flags (state_changing, requires_confirmation)
ToolDefinition "workiq_<name>"
   │  returned by registerTools         src/index.ts
harness tool registry  ──►  chat agent / workflow prompt nodes
   │  execute(input, ctx)
callTool over the same connection  ──►  tool_result (single string)
```

## The stages, and why each one is thin

**The client** (`src/mcp-client.ts`) owns the child process. One stdio
MCP connection backs everything, reused for the server's life; `connect`
is idempotent and coalesces concurrent callers, so there is never a
second child. Launch resolution prefers a globally installed `workiq`
binary on PATH and falls back to `npx` only when none exists, because
`npx` re-checks the npm registry on every launch. Every await here is
timeout-bounded.

**The conversion layer** (`src/json-schema.ts`) is pure: no I/O, fully
unit-tested. It maps JSON-Schema nodes to zod (types, arrays, nested
objects, defaults, nullables) and flattens an MCP `CallToolResult` into
the single string a keelson `tool_result` carries. Its leniency is a
design decision, not a shortcut; see
[Guardrails](../guardrails/).

**The bridge** (`src/bridge.ts`) turns one `McpTool` into one
`ToolDefinition`. The name gains a `workiq_` prefix so the tools bucket
as one family, the converted schema is what the harness parses
arguments against, and two small name sets attach intent: mutating
verbs become `state_changing`, consent-demanding ones
`requires_confirmation`. The bridge takes its transport as an injected
function, so tests exercise it with a fake and never spawn anything.

**The contract surface** (`src/index.ts`) is the only file the harness
sees. `registerTools` is synchronous, so discovery runs at module load
under a top-level `await`, inside a try/catch that is the rib's
fail-soft boundary. The exported `Rib` object is the whole attachment:
an id, a display name, `registerTools`, and a `dispose` that closes the
child on shutdown.

## What never appears in this pipeline

- **A hardcoded tool list.** The set is whatever `tools/list` reports.
  A new upstream tool appears on the next boot with no code change; an
  unknown name simply bridges unflagged.
- **Credentials.** WorkIQ caches its own Microsoft 365 token under your
  user profile. The rib passes no secrets and stores none.
- **A second connection.** Discovery and every later call share one
  child process and one MCP session.
