---
title: The briefing workflow
description: "How the rib ships a workflow as a static YAML file: keelson discovers workflows/ at boot, validates each against its own loader, and merges workiq-briefing into the catalog with no rib code."
sidebar:
  order: 4
---

A rib can add a workflow without writing any code. Drop a YAML file in the
package's `workflows/` folder and the harness discovers it at boot, validates it
against the same loader that backs `workflow_validate`, and merges it into the
catalog. This rib ships one such workflow, `workiq-briefing`, and it is the
simplest contribution the rib makes: pure data, no `contributeWorkflows`
closure, no new module.

The generic workflow model (the DAG, the node types, the run lifecycle) belongs
to the [Keelson](https://danielscholl.github.io/keelson/) docs. This page covers
only what is specific to shipping one from a rib.

## How discovery works

At activation the harness knows each rib's package directory, so it scans
`<package>/workflows/` for `*.yaml` and `*.yml` files. Every file is parsed and
schema-checked on its own; a broken file becomes a catalog notice (visible in the
Workflows UI, not just the server log) rather than taking the rib down. This
mirrors the rib's own fail-soft posture: a bad packaged workflow costs itself,
never the harness.

Unlike the global and project workflow folders, a rib's `workflows/` folder is
read once at boot. A YAML edit inside the package lands on the next server
start, the same as the rest of rib activation.

Two consequences shape the file:

- The `workflows` folder must ship in the published package. It is listed in
  `package.json` `files` alongside `src`, so an installed `@keelson/rib-workiq`
  carries the workflow.
- The workflow's `name:` field is its catalog key, and a same-named global
  workflow would shadow it. The rib namespaces the name under `workiq-` and
  keeps it equal to the filename to avoid a collision.

## What `workiq-briefing` does

The workflow answers one question: what does my workday look like before I open
Outlook? It gathers three slices of the day in parallel, then composes them into
a single briefing.

```text
calendar   inbox   files        (three gather nodes, run in parallel)
   │         │        │          each calls workiq_ask (read-only)
   └─────────┴────────┘
            ▼
        briefing                 (fan-in: composes one at-a-glance summary)
```

Each gather node opts into a single tool with `allowed_tools: [workiq_ask]`.
Rib-registered tools are off by default inside a workflow, so a node reaches the
bridge only by naming the tool it needs — and an `allowed_tools` list restricts
the harness built-ins too, so a gather node holds exactly one tool. The
`briefing` node depends on all three, reads their text through
`$calendar.output`, `$inbox.output`, and `$files.output`, and sets
`allowed_tools: []` — an empty allow-list grants no tools at all, the right
shape for a node that only composes text it was handed.

## Read-only by construction

The briefing only ever reads. The one tool it opts into, `workiq_ask`, is a read
path; none of the mutating verbs the bridge flags `state_changing` appear in any
`allowed_tools` list, and neither do the consent-demanding tools it flags
`requires_confirmation` — a workflow run has no user present to answer a
confirmation. The workflow also sets `mutates_checkout: false`, so it never
touches the project checkout and can run alongside a mutating run on the same
project. A test asserts this posture against the bridge's own intent sets, so a
future edit that grants the workflow a gated tool fails CI.

## Running it

The workflow needs the bridge's tools registered, which means WorkIQ must be
reachable at boot (see [the bridge pipeline](../the-bridge-pipeline/)). When it
is, `workiq-briefing` appears in the Workflows tab and through `workflow_run`.
If WorkIQ was unreachable at boot, the rib registers no tools that boot, so the
gather nodes have nothing to call; start the server again once WorkIQ is signed
in.
