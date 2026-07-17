---
title: Configuration
description: "Every environment variable the rib reads, with defaults, and the launch resolution order they feed."
sidebar:
  order: 3
---

All configuration is optional. With nothing set, the rib prefers a
globally installed `workiq` binary on PATH (a direct launch, no
registry round-trip) and falls back to `npx` only when none is found.

| Env var | Default | Purpose |
| --- | --- | --- |
| `KEELSON_WORKIQ_COMMAND` | *(auto)* | Command that launches the WorkIQ MCP server. |
| `KEELSON_WORKIQ_ARGS` | *(auto)* | Space-separated args for that command. |
| `KEELSON_WORKIQ_CONNECT_TIMEOUT_MS` | `60000` | Bound on the boot-time handshake. |
| `KEELSON_WORKIQ_CALL_TIMEOUT_MS` | `120000` | Per-tool-call timeout. |
| `KEELSON_WORKIQ_DEBUG` | *(unset)* | Set to `1` to inherit the WorkIQ child's stderr. |

## Launch resolution order

The rib resolves how to launch `workiq mcp` in this order; the first
match wins:

1. **`KEELSON_WORKIQ_COMMAND`** set: run that command. Args come from
   `KEELSON_WORKIQ_ARGS` when set, else `mcp`.
2. **`KEELSON_WORKIQ_ARGS`** set alone: pass those args to `npx`.
3. **A global `workiq` binary on PATH** (including Windows `.cmd` /
   `.exe` shims): launch it directly with `mcp`.
4. **Fallback**: `npx -y @microsoft/workiq mcp`. Deliberately not
   pinned to `@latest`, so a warm npx cache can launch offline; only a
   cold cache pays the one-time registry fetch.

A direct binary launch is preferred because `npx` re-checks the npm
registry per launch, which can hang past the connect timeout behind a
slow or TLS-inspecting corporate proxy. Install once with
`npm install -g @microsoft/workiq` and the rib finds it
automatically.

## Timeouts and cancellation

The connect timeout bounds the whole boot handshake; on expiry the rib
logs its warning and registers no tools for that boot. The call
timeout bounds each tool call, and every call also forwards the chat
turn's abort signal, so cancelling a turn cancels its in-flight WorkIQ
call.
