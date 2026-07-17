---
title: Write your own rib
description: "Build a minimal tools-only rib from an empty directory, following the same construction this rib uses, one contract concern at a time."
sidebar:
  order: 2
---

By the end of this tutorial you will have a rib of your own: a package
keelson discovers at boot that registers one working chat tool. Every
step mirrors a file in this repo, so when you outgrow the tutorial the
WorkIQ rib itself is your next reading.

You need Bun, a local [keelson](https://github.com/danielscholl/keelson)
checkout, and nothing else.

## What a rib actually is

Strip away everything optional and a rib is one default export:

- a **package** named `@keelson/rib-<id>`, discovered by scanning
  `node_modules/@keelson` at boot;
- a **`Rib` object** from `@keelson/shared`, with an `id` matching the
  package basename;
- zero or more **hooks** on that object. Every capability a rib can
  have (tools, views, surfaces, workflows, agents, commands, docs,
  policies) is one optional hook on this one interface.

This rib uses exactly two hooks, `registerTools` and `dispose`, which
makes it the smallest complete example that does real work.

## 1. The package

```bash
mkdir keelson-rib-hello && cd keelson-rib-hello
bun init -y
```

Make the `package.json` a rib. Three fields matter: the name (the
`rib-` basename becomes your rib id), the entry point (keelson's Bun
runtime imports TypeScript source directly, so there is no build
step), and the contract as an optional peer:

```json
{
  "name": "@keelson/rib-hello",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "peerDependencies": { "@keelson/shared": ">=0.75.0" },
  "peerDependenciesMeta": { "@keelson/shared": { "optional": true } }
}
```

Then resolve the contract types from your keelson checkout:

```bash
bun link @keelson/shared
```

## 2. The Rib object

Create `src/index.ts` with the minimum:

```ts
import type { Rib } from "@keelson/shared";

const rib: Rib = {
  id: "hello",
  displayName: "Hello",
};

export default rib;
```

This already boots. Link it into your keelson checkout and start the
dev server scoped to your rib:

```bash
mkdir -p ../keelson/node_modules/@keelson
ln -sfn "$PWD" ../keelson/node_modules/@keelson/rib-hello
cd ../keelson && KEELSON_RIBS=hello bun dev
```

The boot log lists the rib; it contributes nothing yet. (The WorkIQ
repo automates the linking with `bun run link:keelson`; see
`dev/link.ts` there.)

## 3. One tool

A tool is a name, a description, a zod schema, and an async `execute`
that emits a `tool_result`. Add one:

```ts
import type { Rib, ToolContext, ToolDefinition } from "@keelson/shared";
import { z } from "zod";

const hello: ToolDefinition = {
  name: "hello_greet",
  description: "Greet someone by name.",
  inputSchema: z.object({ name: z.string().describe("Who to greet") }),
  async execute(input: unknown, ctx: ToolContext): Promise<void> {
    const { name } = input as { name: string };
    ctx.emit({ type: "tool_result", toolUseId: "", content: `Hello, ${name}!` });
  },
};

const rib: Rib = {
  id: "hello",
  displayName: "Hello",
  registerTools: () => [hello],
};

export default rib;
```

Restart the dev server and ask the chat to greet you. The harness
found your tool through the registry; no other wiring exists.

Two conventions to adopt from the start, both visible in this rib's
`src/bridge.ts`:

- **Prefix tool names with your rib id** (`hello_greet`, not `greet`)
  so they bucket as a family and cannot collide with another rib.
- **Flag intent.** A tool that changes real state gets
  `state_changing: true`; one that demands explicit consent gets
  `requires_confirmation: true`. The harness's gates depend on these.

## 4. Errors are results

An `execute` must never throw into the harness. Catch failures and
emit them as error results the agent can read:

```ts
  async execute(input: unknown, ctx: ToolContext): Promise<void> {
    try {
      // ... do the work ...
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.emit({ type: "tool_result", toolUseId: "", content: message, isError: true });
    }
  },
```

## 5. Fail soft at load

If your rib talks to anything external, decide at module load what a
broken dependency costs. The WorkIQ rib's answer, and a good default:
one boot's worth of your tools, never the harness. Its `src/index.ts`
wraps the whole handshake in a try/catch, logs one warning, and
registers nothing on failure. Copy that shape whenever your rib's
boot can fail.

`registerTools` is synchronous, so any async discovery must happen
before it, under a top-level `await`. That is not a workaround; it is
the contract telling you that by the time the harness asks for your
tools, you must already know them.

## 6. Clean up after yourself

If you hold a child process, socket, or watcher, release it in
`dispose`; the harness awaits it at shutdown:

```ts
  async dispose(): Promise<void> {
    await client.close();
  },
```

## Where to go next

You now have every concept this rib is built from. The differences
between your tutorial rib and `@keelson/rib-workiq` are only degree:
its tools come from a discovered MCP server instead of a literal
array (`src/mcp-client.ts`, `src/bridge.ts`), and its schemas are
converted from JSON-Schema instead of written by hand
(`src/json-schema.ts`).

From here:

- Read the [bridge pipeline](../../concepts/the-bridge-pipeline/) with
  the source open; the files are small on purpose.
- Read the [guardrails](../../concepts/guardrails/) and decide which
  of those guarantees your own rib owes its users; most transfer
  directly.
- The rib's
  [ROADMAP](https://github.com/danielscholl/keelson-rib-workiq/blob/main/ROADMAP.md)
  plans one milestone per further contract hook (surfaces, workflows,
  agents, commands); each will land as a worked example you can
  follow the same way.
