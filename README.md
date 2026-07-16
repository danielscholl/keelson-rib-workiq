# @keelson/rib-workiq

A [keelson](https://github.com/danielscholl/keelson) rib that bridges
**Microsoft WorkIQ** — the Microsoft 365 Copilot MCP server — into the harness as
native tools. Install it and a keelson chat (or workflow `prompt` node) can ask
M365 Copilot about your email, meetings, files, and calendar, list available
agents, and read or mutate Microsoft Graph entities.

This is a **tools-only rib**: it contributes no views, surfaces, or workflows —
only the WorkIQ tool set, discovered dynamically from the upstream MCP server.

## How it works

WorkIQ ships an MCP server (`workiq mcp`) that proxies a set of remote M365
Copilot tools. At boot the rib:

1. Spawns `workiq mcp` as a stdio MCP client (once, reused for the server's life).
2. Calls `tools/list` and converts each tool's JSON-Schema `inputSchema` into a
   lenient zod schema.
3. Registers each as a keelson `ToolDefinition` named `workiq_<tool>` (e.g.
   `workiq_ask`, `workiq_list_agents`).

Each tool call is forwarded to WorkIQ over the same connection and its result is
returned to the agent as a `tool_result`. Because discovery is dynamic, new
WorkIQ tools appear automatically on the next server restart — nothing here
hardcodes the tool list.

`registerTools` is synchronous, so the handshake runs at rib load. A failed or
slow handshake costs **this boot** its WorkIQ tools (logged as a warning), never
the harness — the connection reopens on the next start.

## Install

```bash
bun add @keelson/rib-workiq
```

keelson discovers installed `@keelson/rib-*` packages at boot; no wiring is
needed. Scope activation to just this rib with `KEELSON_RIBS=workiq` while
testing.

## Authentication

WorkIQ manages its own Microsoft 365 authentication out of band (it caches a
token under your user profile). Sign in once through the WorkIQ CLI or the
Copilot plugin before relying on the rib; this rib does not store or read any
M365 credential and needs no keelson keychain entry.

## Configuration

All optional. By default the rib prefers a globally-installed `workiq` binary on
`PATH` (a direct launch, no registry round-trip) and falls back to `npx` only
when none is found.

| Env var | Default | Purpose |
| --- | --- | --- |
| `KEELSON_WORKIQ_COMMAND` | _(auto: global `workiq`, else `npx`)_ | Command that launches the WorkIQ MCP server. |
| `KEELSON_WORKIQ_ARGS` | _(auto: `mcp`, or `-y @microsoft/workiq mcp` for the npx fallback)_ | Space-separated args for that command. |
| `KEELSON_WORKIQ_CONNECT_TIMEOUT_MS` | `60000` | Bound on the boot-time handshake. |
| `KEELSON_WORKIQ_CALL_TIMEOUT_MS` | `120000` | Per-tool-call timeout. |
| `KEELSON_WORKIQ_DEBUG` | _(unset)_ | Set to `1` to inherit the WorkIQ child's stderr. |

### Slow or inspected npm registry

`npx @microsoft/workiq@latest` re-checks the npm registry on every launch, which
can blow the handshake timeout behind a slow or TLS-inspecting corporate proxy.
Install the package globally once; the rib then auto-detects the `workiq` binary
and launches it directly, skipping the registry entirely:

```bash
npm install -g @microsoft/workiq
```

No env vars are needed after that. To force a specific launch instead, set
`KEELSON_WORKIQ_COMMAND` / `KEELSON_WORKIQ_ARGS` explicitly.

## Tools

The exact set is whatever `workiq mcp` reports. As of writing it bridges:

| Tool | Purpose |
| --- | --- |
| `workiq_ask` | Ask M365 Copilot about emails, meetings, files, and other M365 data. |
| `workiq_list_agents` | List available M365 Copilot agents. |
| `workiq_search_paths` | Discover available Microsoft Graph entity paths. |
| `workiq_get_schema` | Fetch the OpenAPI schema for an entity operation. |
| `workiq_fetch` | Read one or more Graph entities by path. |
| `workiq_call_function` | Call a Graph function (e.g. `getSchedule`, `delta`). |
| `workiq_do_action` | Execute a Graph action (e.g. `sendMail`, `copy`). |
| `workiq_create_entity` | Create a Graph entity. |
| `workiq_update_entity` | Update a Graph entity. |
| `workiq_delete_entity` | Delete a Graph entity. |
| `workiq_get_debug_link` | Generate a shareable/debug link for a conversation. |
| `workiq_accept_eula` | Accept the WorkIQ EULA. |

Mutating tools (`create_/update_/delete_entity`, `do_action`, `accept_eula`) are
flagged `state_changing`; `accept_eula` and `get_debug_link` are flagged
`requires_confirmation`, surfaced through keelson's `/api/tools` so UI gates and
reviewers see intent.

## Development

```bash
bun install
bun run typecheck
```

The rib is consumed by keelson's Bun runtime, which imports the TypeScript
source directly, so there is no build step — the published package ships its
`src/` and keelson loads it as-is.

## License

Apache-2.0. Not affiliated with or endorsed by Microsoft; "Microsoft 365",
"Copilot", and "WorkIQ" are trademarks of Microsoft.
