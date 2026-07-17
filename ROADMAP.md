# Roadmap

This rib has two jobs: bridge Microsoft 365 into keelson, and teach the `Rib`
contract by worked example. The roadmap serves both at once — every milestone
adds real M365 capability **and** demonstrates exactly one new contract hook,
in the order a rib author would want to learn them. Land them one at a time;
each is a self-contained PR-sized (or small-series) slice with its own docs
page.

The contract hooks not yet exercised, from `@keelson/shared`'s `Rib` interface:
`authStatus`, `listCommands`/`invokeCommand`/`completeCommand`,
`listAgents`/`resolveAgent`, `contributeWorkflows`, `views`, `surfaces`,
`onAction`, `onRunEvent`, `contributePolicies`, `composeBundle`,
`acceptsIngest`. Today the rib uses `registerTools`, `contributeDocs`, and
`dispose`.

Every milestone shares one definition of done:

- The hook lands in `src/` at the same clarity bar as the existing modules —
  small, single-concern, commented only where the why is non-obvious.
- Tests cover it without spawning WorkIQ (extend the fake-transport seam).
- A docs page teaches it (the drift check should learn the new surface too).
- The milestone's entry here moves to the Landed section with a one-line
  retrospective: what the implementation taught that the plan missed.

---

## M1 — Honest health: `authStatus`

**What it delivers.** The Ribs page (and doctor) shows whether WorkIQ is
reachable and signed in, instead of the current silence when the boot
handshake fails. Operators stop debugging "no tools" by reading boot logs.

**The teaching point.** The smallest optional hook there is: one probe
function returning a typed status. Perfect first extension because it touches
no tool path — it only reports. Demonstrates that a rib should tell the truth
about its own degraded states.

**Design sketch.** Probe cheaply: report `connected` when the boot handshake
succeeded (the client already knows), `signed-out` / `unreachable` otherwise,
with the boot warning's message as detail. No new child process; never block
the probe on a live WorkIQ round-trip longer than a short bound.

## M2 — A front door: slash commands

**What it delivers.** `/copilot <question>` in the chat composer: type-ahead
into a seeded question against `workiq_ask`. Later `/briefing` (M4+) hangs off
the same hook.

**The teaching point.** `listCommands` / `invokeCommand` / `completeCommand`,
and the contract's most instructive constraint: `invokeCommand` must be a
**side-effect-free resolver** that returns a closed effect the surface
performs. Teaches the trust boundary between rib logic and trusted surfaces.

**Design sketch.** One command descriptor; `invokeCommand` returns an
open-chat effect seeded with the question. No completer needed for free text
(add one only when a command grows enumerable arguments).

## M3 — A named colleague: the M365 agent

**What it delivers.** An "M365 Copilot" agent in the agent picker: a seeded
chat whose system prompt frames the workiq tool family, sets tenant etiquette
(read freely, confirm before writing), and knows about `conversationId`
continuity for multi-turn `ask`.

**The teaching point.** `listAgents` / `resolveAgent` — cheap summaries
resolved lazily into an `OpenChatSeed`. Teaches the pattern of *naming* a
capability so users can reach for it, without new runtime machinery.

## M4 — The extraction: a briefing workflow

**Landed in part.** The gathering workflow ships today as static YAML,
`workflows/workiq-briefing.yaml`, discovered from the rib's `workflows/` folder
(see Landed). What remains here is the upgrade from a read-only, on-demand
briefing to one that publishes **state the harness can render**.

**What it delivers.** Promote the briefing from folder YAML to a
`contributeWorkflows` contribution bound to a rib-namespaced snapshot key
(`rib:workiq:briefing`), emitting a structured briefing document rather than
prose.

**The teaching point.** `contributeWorkflows`, and with it half the platform:
snapshot keys and namespacing, `output_schema` promotion, fail-closed
`validate` before publish. The static-YAML slice already proved a rib can ship
a workflow with zero code; the hook earns its place only once the workflow must
bind a key the folder path cannot.

**Design sketch.** A `prompt` node (the agent gathers via workiq tools and
emits JSON matching the schema) is the natural shape — this rib's data source
is conversational, unlike the osdu rib's CLI collectors; that contrast is
itself worth a design page. Define the briefing document type in `src/` with a
zod schema so the workflow, the validate step, and the tests share one truth.
Runs on demand first; cadence arrives with the surface in M5.

## M5 — The centerpiece: a Daily Briefing surface

**What it delivers.** A **Daily Briefing** tab in keelson: a board rendering
the briefing snapshot — your day at a glance before you open Outlook. Regions
on a refresh cadence (`cadenceMs`) re-run the M4 workflow, so the board stays
current without any resident process.

**The teaching point.** `views` + `surfaces` — descriptors binding snapshot
keys to canvas renderers and laying out regions — and the **zero React**
invariant: a surface is declared, not hand-coded; the harness's trusted
primitives render it. Also the boot-vs-runtime split the contract documents:
region workflow bindings are read once at boot.

**Design sketch.** Start with one view (`briefing` board) on a simple surface:
banner (next meeting / now), rows (inbox highlights, waiting-on-you), footer
(recent files). Screenshots land in the docs per STYLE.md once this exists.

## M6 — Acting from the board: `onAction`

**What it delivers.** Briefing board verbs: *Refresh now* (re-run the
workflow), *Open in chat* (seed a chat about an item with the M3 agent), and —
carefully — *Draft reply*, which routes through the flagged mutating tools so
every write still passes the harness's gates.

**The teaching point.** `onAction` and action routing (`ribIdFromKey`), plus
the discipline that actions **reuse** the tool layer rather than bypassing it:
a board button must clear the same `state_changing` gates a chat call would.

## M7 — Governance made visible: a write policy

**What it delivers.** A contributed policy that requires explicit confirmation
for any `workiq_*` write beyond the flags — e.g. deny `sendMail`-class actions
inside workflow runs entirely, allow them in chat only with confirmation.

**The teaching point.** `contributePolicies` — the harness composes rib
policies with its builtins behind one engine. Teaches that a rib can ship
*guardrails*, not just capabilities, and closes the loop the docs' Guardrails
page opens: prompt injection via M365 content is mitigated by gates, and here
the rib tightens its own.

## M8 — A platform, not just a plugin: cross-rib consumption

**What it delivers.** The original motivation for this rib, made first-class:
another rib (or a chamber/squad mind) consumes workiq tools — e.g. an osdu rib
briefing that folds in your M365 calendar, or a squad coordinator that checks
your availability before scheduling work.

**The teaching point.** The cross-rib surface (`RibContext.callTool`,
reachability, cross-rib grants) and the docs contract for it: how a rib
documents its tools so *other ribs* — not just chat agents — can build on
them. Likely mostly a documentation-and-example milestone; any gaps it finds
belong upstream in keelson.

## Later / unsorted

Ideas that are real but not yet sequenced; promote one when it earns a slot:

- **`composeBundle`** — fold a compact calendar/presence snapshot into the
  chat's compose bundle so every conversation is schedule-aware without a tool
  call. Needs care: token cost vs. utility, staleness rules.
- **`onRunEvent`** — track briefing workflow runs so the surface can show
  "refreshing…" and last-success honestly; pairs with M5/M6.
- **`acceptsIngest`** — accept a dropped .eml/.ics/file and answer about it in
  tenant context.
- **Auth-guided recovery** — when `authStatus` reports signed-out, a board
  action or command that walks the operator through `workiq auth login`
  (the rib still never touches the token itself).
- **Briefing history** — retain N briefing snapshots and render deltas ("new
  since yesterday"). Teaches rib-owned storage conventions; look at how the
  chamber/squad ribs manage data homes first.

## Landed

*(Move milestones here as they ship, with a one-line retrospective each.)*

- **M0 — The bridge itself** (v0.1): dynamic discovery, lenient schemas,
  fail-soft boot, flagged writes; `registerTools` + `contributeDocs` +
  `dispose`. Retrospective: synchronous `registerTools` forced the boot-time
  top-level await that now anchors the whole teaching narrative — the
  constraint became the curriculum.

- **Static YAML briefing workflow** (v0.3): `workflows/workiq-briefing.yaml`,
  discovered from the rib's `workflows/` folder — a fan-out/fan-in briefing over
  the bridge's read-only `workiq_ask`, with the docs-drift check taught to guard
  the new surface. Retrospective: the plan filed the whole briefing under
  `contributeWorkflows`, but the folder-discovery capability ships a workflow as
  pure data with no hook at all — the hook only earns its place once a workflow
  must bind a snapshot key (M4's remainder), so the simplest teaching slice
  comes first and for free.
