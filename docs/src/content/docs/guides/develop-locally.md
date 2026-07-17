---
title: Develop locally
description: "Link the rib into a local keelson checkout, keep the three checks green, and debug the WorkIQ handshake."
sidebar:
  order: 3
---

The rib is a standalone Bun package. Development needs two links: one
to resolve the `Rib` contract types, one to make a local keelson
discover your working copy.

## Set up

```bash
git clone https://github.com/danielscholl/keelson-rib-workiq.git
cd keelson-rib-workiq
bun install
bun link @keelson/shared   # the Rib contract, from your keelson checkout
```

`@keelson/shared` is an optional peer dependency: the harness provides
it at runtime, and for development you resolve it from a keelson
checkout.

## Run it inside a harness

```bash
bun run link:keelson   # symlinks this rib into ../keelson (KEELSON_DIR overrides)
cd ../keelson && KEELSON_RIBS=workiq bun dev
```

The dev server's boot log tells you immediately whether the bridge came
up. Live tool calls additionally need WorkIQ installed and signed in;
without it the rib still loads, logs its warning, and registers no
tools for that boot.

## Run the tests

```bash
bun test
```

The suite exercises the conversion layer, the bridge (through its
injected transport seam), the launch resolution, and the rib's contract
shape. By design none of it needs a WorkIQ install, a sign-in, or a
network. Contribution conventions and the full pre-PR checklist live in
the repo's
[CONTRIBUTING.md](https://github.com/danielscholl/keelson-rib-workiq/blob/main/CONTRIBUTING.md).

## Debug the handshake

When the boot warning appears, make the child's stderr visible:

```bash
KEELSON_WORKIQ_DEBUG=1 KEELSON_RIBS=workiq bun dev
```

The usual causes, in order of frequency:

- **WorkIQ not signed in.** Run `workiq auth login` outside keelson
  first; confirm `workiq mcp` starts on its own.
- **No global binary, slow registry.** The `npx` fallback re-resolves
  the package each launch; install globally
  (`npm install -g @microsoft/workiq`) or raise
  `KEELSON_WORKIQ_CONNECT_TIMEOUT_MS`.
- **A custom launch that does not speak MCP.** If you set
  `KEELSON_WORKIQ_COMMAND`, the command must behave like `workiq mcp`:
  an MCP server on stdio.
