# Copilot code review — instructions for @keelson/rib-workiq

This rib bridges **Microsoft WorkIQ** — the M365 Copilot MCP server — into
[Keelson](https://github.com/danielscholl/keelson), the local-only agent harness
— a single-package Bun + TypeScript project. At boot it spawns `workiq mcp` as a
stdio MCP client, discovers the upstream tool set dynamically, converts each
tool's JSON-Schema input into a lenient zod schema, and registers each as a
keelson chat tool (`workiq_<tool>`). It is **tools-only** today — no views,
surfaces, or workflows — and ships **zero React**. See `AGENTS.md` for the full
architecture.

## How to review

Be terse and cite `file:line`. Prefer a few high-signal findings over breadth.
This is single-user, local software — ignore speculative scale, multi-tenant, and
micro-optimization concerns. No poems, jokes, or emoji.

## Comment policy — do NOT push comments or docstrings

`CONTRIBUTING.md` sets a deliberate **no-narration** policy. Do **not**:

- Ask for docstrings or comment coverage. Comments are optional; a one-line
  soft-wrap is fine and should not be flagged.
- Suggest comments that narrate what a PR changed, restate well-named code, or
  recap review history.

A comment is warranted only when it captures a non-obvious **why** (a hidden
constraint, a workaround, an order dependency, an invariant from another module).
Flag a comment only when it *violates* the policy (narration / what-just-changed),
not when one is merely absent.

## Invariants to protect — flag violations of these

- **The bridge stays dynamic.** The tool list comes from `tools/list` at boot,
  never hardcoded. The only per-tool knowledge allowed is intent metadata (the
  mutating / confirmation name sets), and unknown upstream names must pass
  through unflagged rather than break. Flag any change that pins the tool list
  or drops a tool by name.
- **Mutating tools stay flagged.** Anything that can change M365 state (send
  mail, create/update/delete Graph entities, `do_action`, `accept_eula`) must
  carry `state_changing: true`; consent-demanding tools keep
  `requires_confirmation`. Flag a new write-path verb that would land unflagged.
- **Fail soft at boot, never the harness.** A failed or slow WorkIQ handshake
  must cost this boot its WorkIQ tools (a logged warning), not throw out of
  module load. Flag anything that lets a handshake error escape.
- **Lenient schemas by intent.** The JSON-Schema → zod conversion must not get
  stricter than upstream: the harness `.parse()`s arguments before the bridge,
  and WorkIQ validates server-side, so a too-strict schema rejects calls WorkIQ
  would accept. Flag added strictness (dropped `.catchall`, required-by-default
  fields).
- **One child, bounded awaits.** A single reused MCP connection backs every
  call; `connect` is idempotent and coalesced. Every upstream await (connect,
  tool call) is timeout-bounded and forwards the caller's abort signal. Flag a
  second connection path or an unbounded await.
- **No credential handling.** WorkIQ owns M365 auth out of band. The rib must
  never read, store, log, or forward tokens or auth material. Flag any code
  that touches the WorkIQ token cache or logs auth-bearing output.
- **Attach only through the `Rib` contract** (`@keelson/shared`). Flag imports
  that reach around it into harness internals.

## Expected patterns — do not flag these

- Top-level `await` in `src/index.ts`: `registerTools` is synchronous, so
  discovery must complete at module load. The try/catch around it is the
  fail-soft boundary.
- `z.unknown()` / `.catchall(z.unknown())` in the schema conversion — leniency
  is deliberate (see above), not missing validation.
- Empty tool registration when WorkIQ is unreachable — the rib is designed to
  boot degraded and recover on the next server start.
