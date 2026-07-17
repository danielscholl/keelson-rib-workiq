# Contributing to @keelson/rib-workiq

Thanks for your interest in the WorkIQ rib. This document captures the
conventions and required checks for every pull request. This rib is a
[Keelson](https://github.com/danielscholl/keelson) rib — a standalone package the
harness discovers at runtime — so its contribution flow is lighter than the
keelson monorepo's. Where this file is silent, the
[keelson CONTRIBUTING guide](https://github.com/danielscholl/keelson/blob/main/CONTRIBUTING.md)
is the parent.

This rib is also keelson's **teaching rib** — the reference for how a rib is
constructed. That raises the bar in one specific way: prefer the clear version
of a change over the clever one, and when a change alters how the rib attaches
to the harness, update the docs that teach it.

## Development environment

You need [Bun](https://bun.sh/) on PATH. The rib has one runtime peer,
`@keelson/shared`, which the harness provides at runtime; for local development
you resolve it from a keelson checkout.

```bash
git clone https://github.com/danielscholl/keelson-rib-workiq.git
cd keelson-rib-workiq
bun install
bun link @keelson/shared   # resolves the contract from your local keelson checkout
                           # (or recreate node_modules/@keelson/shared by hand)
```

`@keelson/shared` is declared an **optional** peer dependency: the rib installs
and its tests run without it linked for type-only imports, but typechecking
against the `Rib` contract needs it. CI resolves it the same way — a symlink to
a `danielscholl/keelson` checkout's `packages/shared`, sourced from `main`, so a
harness contract change that breaks this rib turns CI red here.

To exercise the rib inside a running harness, link it into a local keelson and
launch the dev server:

```bash
bun run link:keelson   # defaults to ../keelson; override with KEELSON_DIR
cd ../keelson && KEELSON_RIBS=workiq bun dev
```

Live tool calls need Microsoft WorkIQ working outside keelson first: install it
(`npm install -g @microsoft/workiq`) and sign in once through its CLI. Without
it the rib still loads — it logs a boot warning and registers no tools that
boot. Set `KEELSON_WORKIQ_DEBUG=1` to inherit the WorkIQ child's stderr when
debugging the handshake.

## Required checks before opening a PR

Every PR must keep these green. CI runs the same commands.

```bash
bun run check       # Biome lint + format check
bun run typecheck   # tsc --noEmit (needs @keelson/shared linked)
bun test            # pure bridge/schema coverage — never spawns WorkIQ
```

Run `bun run check:fix` to auto-fix the safe lint and format issues.

If you touched the documentation site under `docs/`, build it too — `docs.yml`
runs the same build on every `docs/**` change:

```bash
cd docs && bun install && bun run build
```

## Commit messages

Conventional commit format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
`test:`). One sentence in the subject (under 70 characters). The squashed PR
title becomes the commit subject and is validated by `pr-title.yml`, so it must
be a conventional commit. Body — when needed — explains *why*, not *what*; the
diff already shows the what.

## Pull request hygiene

- Keep PRs scoped to one thing. Split refactors out of feature work.
- The PR description should answer: what changed, why now, how it was tested.
- Don't add new abstractions ahead of a concrete second caller.
- Don't add comments that narrate the change — that belongs in the PR
  description, not the source. Add a comment only when it captures a non-obvious
  *why* a future reader would need.

## Architecture rules

- All WorkIQ and M365 knowledge lives in this rib. The harness stays
  domain-free; don't push WorkIQ specifics into keelson.
- The rib attaches to the harness only through the `Rib` contract
  (`@keelson/shared`). Don't reach around it into harness internals.
- **The bridge stays dynamic.** The tool list is discovered from `tools/list`
  at boot, never hardcoded. Per-tool knowledge is limited to intent metadata
  (the mutating / confirmation name sets), and unknown upstream names must pass
  through unflagged rather than break.
- **Mutating tools stay flagged.** Any bridged tool that can change M365 state
  must carry `state_changing: true`; consent-demanding tools carry
  `requires_confirmation`. The harness's UI gates depend on these flags.
- **Fail soft at boot.** A failed or slow WorkIQ handshake costs that boot its
  WorkIQ tools (a logged warning) — it must never throw out of module load or
  take the harness down.
- **Lenient schemas by intent.** The JSON-Schema → zod conversion must not be
  stricter than upstream: the harness `.parse()`s arguments before the bridge
  and WorkIQ validates server-side, so added strictness only rejects calls
  WorkIQ would have accepted.
- **No credential handling.** WorkIQ manages M365 auth out of band. The rib
  never reads, stores, logs, or forwards tokens or auth material.
- **Tests never spawn WorkIQ.** Keep the pure layers (schema conversion, result
  serialization, tool bridging) testable without a child process, a network, or
  a WorkIQ install.

## License and attribution

The rib is Apache-2.0 (see [LICENSE](LICENSE)). It bundles no Microsoft code —
it spawns the separately-installed WorkIQ CLI and talks to it over MCP.
"Microsoft 365", "Copilot", and "WorkIQ" are Microsoft trademarks; the rib is
not affiliated with or endorsed by Microsoft (see [NOTICE](NOTICE)).

## Security

For security-sensitive reports, see [SECURITY.md](SECURITY.md). Please do not
file public GitHub issues for vulnerabilities.
