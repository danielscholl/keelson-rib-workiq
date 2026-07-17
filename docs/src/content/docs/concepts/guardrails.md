---
title: Guardrails
description: "The rib's standing guarantees: a bad handshake costs one boot, schemas never out-validate the server, M365 writes are always flagged, and no token ever passes through."
sidebar:
  order: 3
---

The bridge is small, but it sits between an agent and a real Microsoft
365 tenant. These are the guarantees the code holds, and every change
is reviewed against them.

## A bad handshake costs one boot, never the harness

`registerTools` is synchronous, so discovery must finish at module
load. That makes the load itself the failure point, and the rib treats
it accordingly: the whole handshake runs inside one try/catch. If
WorkIQ is not installed, not signed in, or slow past the connect
timeout, the rib logs one warning, registers no tools, and the harness
boots on unbothered. The connection reopens on the next server start.

## Schemas stay lenient on purpose

The zod schema produced for each tool is deliberately no stricter than
the JSON-Schema WorkIQ published. The harness `.parse()`s tool
arguments *before* the bridge sees them, and WorkIQ validates again
server-side. Any strictness the conversion added on top could only do
one thing: reject a call the server would have accepted. So objects
tolerate extra keys, untyped nodes accept anything, and a missing
schema falls back to a permissive object. Validation errors that
matter come from the server that owns the data.

## Writes are always flagged

WorkIQ marks only `accept_eula` destructive in machine-readable form,
so the bridge carries a short list of known mutating verbs
(`create_entity`, `update_entity`, `delete_entity`, `do_action`,
`accept_eula`) and flags them `state_changing`; consent-demanding
tools (`accept_eula`, `get_debug_link`) are flagged
`requires_confirmation`. The harness's UI gates key off these flags,
so an agent cannot quietly send mail or delete a Graph entity. The
sets are intent metadata only: a name missing from them still bridges,
just unflagged, so discovery never breaks on an unknown tool.

## One child, every await bounded

A single child process backs the rib for the server's life. The
connect is bounded by `KEELSON_WORKIQ_CONNECT_TIMEOUT_MS` (default
60s), each tool call by `KEELSON_WORKIQ_CALL_TIMEOUT_MS` (default
120s), and each call forwards the chat turn's abort signal, so a
cancelled turn cancels its WorkIQ call. A hung server can slow one
answer; it cannot wedge the event loop or leak children.

## No credential handling, by construction

The rib holds no keychain entry and reads no token cache. Sign-in
happens once, out of band, through WorkIQ's own CLI; the rib inherits
the environment so the child can find its cached token, and that is
the entire extent of its involvement with auth. A change that logs,
stores, or forwards auth material is a bug by definition, and the
[security policy](https://github.com/danielscholl/keelson-rib-workiq/blob/main/SECURITY.md)
treats it as one.

## Errors are results, not exceptions

A failed tool call, upstream error flag, or thrown transport error is
serialized into an error `tool_result` the agent can read and react
to. Nothing escapes `execute` into the harness's turn loop.
