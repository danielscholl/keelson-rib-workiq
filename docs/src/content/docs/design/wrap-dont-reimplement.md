---
title: Wrap, don't reimplement
description: "The founding decisions: bridge the MCP server dynamically, pay for discovery at boot, prefer the global binary, and ship tools-only first."
sidebar:
  order: 2
---

Four decisions define this rib. Each traded something away on
purpose; recording the trade keeps a future change honest.

## Bridge the server, own none of the domain

Microsoft already ships the M365 integration as an MCP server. The
rib could have called Microsoft Graph itself: its own auth flow, its
own endpoint wrappers, its own update treadmill as Graph evolves.
Instead it treats `workiq mcp` as the single source of truth and
bridges whatever the server reports. The cost is a runtime dependency
on the WorkIQ CLI being installed and signed in. The win is that the
rib contains zero M365 logic to maintain: when WorkIQ grows a tool,
this rib grows the same tool at the next boot, with no release.

The one exception is intent metadata. WorkIQ marks only `accept_eula`
destructive in machine-readable form, so the bridge name-matches the
known mutating verbs to set `state_changing`. That list is the single
piece of upstream knowledge the rib owns, and it fails open by
design: an unknown name bridges unflagged rather than breaking
discovery.

## Pay for discovery at boot

`registerTools` is synchronous in the `Rib` contract, so the rib
cannot lazily discover tools on first use. Discovery therefore runs
at module load under a top-level `await`, bounded by a connect
timeout, wrapped in the fail-soft try/catch. The cost is a slower
first boot when WorkIQ is cold, and tools that appear only on
restart. The win is a harness that never blocks mid-session on a
handshake, and a failure mode that is one logged warning instead of
a broken chat turn.

## Prefer the global binary over npx

The rib originally launched WorkIQ through `npx` with a pin to the
latest published version, forcing a registry round-trip on every
start. Behind a TLS-inspecting corporate proxy that per-launch check
regularly blew the 60-second handshake budget, which surfaced as the
rib silently registering no tools. The fix inverted the preference:
probe PATH for a globally installed `workiq` first and launch it
directly; keep `npx` only as the cold-start fallback, without a
version pin so a warm cache can launch offline. The cost is that a
stale global install stays stale until the operator updates it. That
is judged acceptable: boot reliability beats auto-freshness for a
tool on the critical path of every boot.

## Tools-only first

The `Rib` contract offers far more than tools: views, surfaces,
workflows, agents, slash commands, policies. This rib ships none of
them yet, on purpose. Tools were the smallest slice that is useful on
day one, and the smallest complete example of the contract for the
rib's second job as the teaching rib. The evolution is planned, not
abandoned: the repo's
[ROADMAP](https://github.com/danielscholl/keelson-rib-workiq/blob/main/ROADMAP.md)
sequences one milestone per contract hook, each designed to be read
as a worked example, in the order a rib author would want to learn
them.
