---
title: Bridged tools
description: "The workiq_ tool family: every tool the bridge registers, what it does, and which carry the state_changing and requires_confirmation flags."
sidebar:
  order: 2
---

The exact set is whatever `workiq mcp` reports at boot; nothing here is
hardcoded, and a new upstream tool appears on the next restart with no
rib change. The table below is the set WorkIQ ships as of this writing.
Every bridged name gains the `workiq_` prefix so the family buckets
together in `/api/tools`.

| Tool | Purpose |
| --- | --- |
| `workiq_ask` | Ask M365 Copilot about emails, meetings, files, and other M365 data. |
| `workiq_list_agents` | List available M365 Copilot agents. |
| `workiq_search_paths` | Discover available Microsoft Graph entity paths. |
| `workiq_get_schema` | Fetch the OpenAPI schema for an entity operation. |
| `workiq_fetch` | Read one or more Graph entities by path. |
| `workiq_call_function` | Call a Graph function (for example `getSchedule`, `delta`). |
| `workiq_do_action` | Execute a Graph action (for example `sendMail`, `copy`). |
| `workiq_create_entity` | Create a Graph entity. |
| `workiq_update_entity` | Update a Graph entity. |
| `workiq_delete_entity` | Delete a Graph entity. |
| `workiq_get_debug_link` | Generate a shareable/debug link for a conversation. |
| `workiq_accept_eula` | Accept the WorkIQ EULA. |

## Intent flags

The harness's UI gates key off two flags the bridge attaches:

- **`state_changing`** marks tools that can change M365 state. The
  mutating verbs `create_entity`, `update_entity`, `delete_entity`,
  `do_action`, and `accept_eula` are always flagged, and any tool the
  upstream annotates `destructiveHint` is flagged too.
- **`requires_confirmation`** marks tools whose own descriptions demand
  explicit user consent: `accept_eula` and `get_debug_link`.

A tool named in neither set bridges unflagged, which is deliberate:
the sets are intent metadata, not an allowlist, so unknown upstream
names never break discovery. See
[Guardrails](../../concepts/guardrails/) for the reasoning.

## Multi-turn conversations

`workiq_ask` returns a `conversationId` in its structured content,
serialized into the tool result. Passing it back on a later `ask` call
continues the same Copilot conversation.
