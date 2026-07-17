---
title: Install the rib
description: "Add @keelson/rib-workiq to a Keelson install, set up WorkIQ auth once, and verify the bridged tools appear."
sidebar:
  order: 2
---

Three things have to be true for the bridge to light up: the rib is
installed where keelson discovers it, a WorkIQ launch path exists, and
WorkIQ is signed in to your Microsoft 365 account. Each is a one-time
step.

## 1. Install the rib

```bash
bun add @keelson/rib-workiq
```

Keelson discovers installed `@keelson/rib-*` packages at boot; no
wiring is needed. While testing, scope activation to just this rib:

```bash
KEELSON_RIBS=workiq keelson serve
```

## 2. Install WorkIQ globally

The rib can fall back to `npx @microsoft/workiq`, but a global install
is strongly preferred: `npx` performs a registry round-trip on launch,
which can blow the boot handshake timeout behind a slow or
TLS-inspecting proxy.

```bash
npm install -g @microsoft/workiq
```

With the binary on PATH the rib launches it directly and skips the
registry entirely. No configuration is needed; the launch resolution
is automatic. To force a specific launch instead, set
`KEELSON_WORKIQ_COMMAND` and `KEELSON_WORKIQ_ARGS` (see the
[configuration reference](../../reference/configuration/)).

## 3. Sign in once

WorkIQ manages its own Microsoft 365 authentication and caches a token
under your user profile. Sign in through its CLI before relying on the
rib:

```bash
workiq auth login
```

The rib stores no credential and needs no keelson keychain entry; if
the cached token expires, re-run the sign-in.

## 4. Verify

Start keelson and check the boot log for the bridge line:

```text
[keelson] rib 'workiq' bridged 12 WorkIQ tool(s)
```

Then ask the chat something only your tenant can answer, for example
"what is on my calendar today?". The agent should reach for
`workiq_ask`. If the boot log shows a warning instead of the bridge
line, the handshake failed; the
[local development guide](../develop-locally/) covers debugging it.
