# AGENTS.md

This is the canonical project guidance for coding agents — Codex, GitHub
Copilot's coding agent, and (via an import in `CLAUDE.md`) Claude Code — working
in this repository. `CONTRIBUTING.md` is the authoritative human guide; this is
its agent-facing distillation.

It records only what stays true across changes: the contract, the commands, the
patterns, and the invariants. Inventories — which modules exist, which upstream
tools are bridged or flagged — live in the code, change over time, and are
deliberately NOT recorded here. Derive them from the code when you need them;
the `/prime` command does exactly that.

## What this is

`@keelson/rib-workiq` is a **rib** (extension) for
[Keelson](https://github.com/danielscholl/keelson), the local-only agent harness.
A rib is a standalone package the harness discovers at runtime and attaches
through one typed contract — the `Rib` interface from `@keelson/shared`. This rib
is the **WorkIQ bridge**: it spawns Microsoft WorkIQ's MCP server (`workiq mcp`)
as a stdio child, discovers its tool set dynamically, and registers each tool as
a keelson chat tool (`workiq_<tool>`) so a chat or workflow `prompt` node can
reach M365 Copilot and Microsoft Graph. It is **tools-only** today — no views,
surfaces, or workflows — and doubles as the reference implementation for "how to
write a rib," so clarity of construction is a feature here, not a nicety.

## Commands

Bun. Everything is workspace-local; there is no monorepo.

```bash
bun install                  # one-time
bun link @keelson/shared     # resolve the Rib contract from a local keelson checkout

bun test                     # pure bridge/schema coverage — never spawns WorkIQ
bun run typecheck            # tsc --noEmit (needs @keelson/shared linked)
bun run check                # Biome lint + format (required pre-PR)
bun run check:fix            # auto-fix safe lint/format

bun run link:keelson         # symlink this rib into ../keelson (override with KEELSON_DIR)
cd ../keelson && KEELSON_RIBS=workiq bun dev   # exercise it in a running harness
```

`CONTRIBUTING.md` gates every PR on `bun run check`, `bun run typecheck`, and
`bun test` all green. CI resolves `@keelson/shared` as a symlink to a
`danielscholl/keelson` checkout's `packages/shared` from `main`, so a harness
contract change that breaks this rib turns CI red here.

## Architecture (the shapes, not the inventory)

The whole rib is one `Rib` object exported from `src/index.ts`, assembled from
a handful of small modules with one role each. The whole of `src/` is short
enough to read in full — do that rather than trusting any map. The roles:

- **The contract surface** (`src/index.ts`) — runs the boot-time discovery
  (top-level `await`, because `registerTools` is synchronous) inside a
  fail-soft try/catch: a failed or slow handshake costs this boot its WorkIQ
  tools (a logged warning), never the harness. Exports the `Rib`. Discovery is
  skipped under `NODE_ENV=test` so a test run never spawns a WorkIQ child.
- **The per-tool conversion** (`src/bridge.ts`) — pure: one upstream MCP tool →
  one keelson `ToolDefinition`, with the live call injected so tests pass a
  fake. The only per-tool knowledge is intent metadata (the mutating /
  confirmation name sets); a tool failure is emitted as a readable
  `tool_result`, never an exception escaping into the harness's turn loop.
- **The connection** (`src/mcp-client.ts`) — one stdio MCP client to the WorkIQ
  child, reused for the server's life; `connect` is idempotent and coalesces
  concurrent callers. Launch resolution prefers a global `workiq` binary on
  PATH over the `npx` fallback (npx re-checks the registry per launch). Every
  await is timeout-bounded (`KEELSON_WORKIQ_CONNECT_TIMEOUT_MS`,
  `KEELSON_WORKIQ_CALL_TIMEOUT_MS`).
- **The schema/result conversion** (`src/json-schema.ts`) — pure: JSON-Schema
  `inputSchema` → lenient zod schema, and MCP `CallToolResult` → the single
  string a keelson `tool_result` carries. No I/O; fully unit-tested.

## Invariants worth protecting

- **The bridge stays dynamic.** The tool list comes from `tools/list`, never
  hardcoded. The only per-tool knowledge is intent metadata (the mutating /
  confirmation name sets in `src/bridge.ts`); unknown upstream names pass
  through unflagged rather than break, so new WorkIQ tools appear on the next
  restart with no code change.
- **Mutating tools stay flagged.** M365 write verbs carry
  `state_changing: true` and consent-demanding tools carry
  `requires_confirmation` — the intent name sets are the source of truth for
  which. The harness's UI gates depend on these flags.
- **Fail soft at boot, never the harness.** Handshake errors are caught at
  module load and logged; the rib registers no tools that boot and recovers on
  the next server start.
- **Lenient schemas by intent.** The zod conversion must not get stricter than
  upstream — the harness `.parse()`s arguments before the bridge and WorkIQ
  validates server-side, so added strictness only rejects calls WorkIQ would
  have accepted.
- **One child, bounded awaits.** A single reused connection backs every call;
  connect/call awaits are timeout-bounded and forward the caller's abort
  signal.
- **No credential handling.** WorkIQ owns M365 auth out of band (its own token
  cache). The rib never reads, stores, logs, or forwards auth material and
  needs no keelson keychain entry.
- **Attach only through the `Rib` contract** (`@keelson/shared`). Don't reach
  around it into harness internals.
- **Tests never spawn WorkIQ.** `bun test` exercises the pure layers and the
  rib shape without a network or a WorkIQ install.

## Comments

`CONTRIBUTING.md` is authoritative. Default to **none**. Add a comment only when
it captures a non-obvious **why** a future reader needs — a hidden constraint, a
workaround, a non-obvious order dependency, an invariant from another module.

- No multi-paragraph blocks or bulleted `/* */` explanations. A one-sentence
  soft-wrap over two lines is fine.
- No PR-point-in-time narration ("Codex flagged…", "Per review…", "Addresses
  #N"). That belongs in the commit message or PR body.
- No what-just-changed notes, and no restating well-named code.

## Conventions

- **Commits**: conventional (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`), one-sentence subject under ~70 chars. The squashed PR title becomes
  the commit subject, so the **PR title must be a conventional commit**
  (`pr-title.yml` enforces it) — keeping history release-ready.
- **PR body**: *What* / *Why now* / *Test plan* (the template), plus an optional
  *Risk & rollback*. No "Generated with" footers.
- **No abstractions ahead of a concrete second caller.**

## Documentation

The docs site lives under `docs/` — a self-contained **Astro Starlight** project
(its own `bun install` + lockfile). Read **`docs/STYLE.md`** (it extends
keelson's style guide) before adding or editing a docs page. Because this rib is
also the teaching rib, docs changes are first-class: a change to the bridge's
behavior that isn't reflected in the docs is incomplete. Build locally with
`cd docs && bun install && bun run build`; `docs.yml` builds and deploys it on
every `docs/**` change. `ROADMAP.md` holds the planned capability milestones —
each one demonstrates another hook of the `Rib` contract; keep it current when
landing one.
