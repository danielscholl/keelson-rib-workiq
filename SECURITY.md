# Security Policy

Thanks for taking the time to make the WorkIQ rib safer.

## Supported versions

The WorkIQ rib is pre-1.0 (`0.x`) software. Security fixes land on the
latest minor release line only. Once 1.0 ships, this policy will document
a longer support window.

| Version                         | Supported          |
|---------------------------------|--------------------|
| Latest `0.x` minor release line | :white_check_mark: |
| Any older release               | :x:                |

## Reporting a vulnerability

**Please do not file public GitHub issues for security reports.** Public
issues become indexable the moment they're created and give an attacker
a head start on any users who haven't updated yet.

Instead, report privately via one of these channels:

- Email: **degnome@gmail.com** with subject line `[workiq security]`
- GitHub private vulnerability report:
  <https://github.com/danielscholl/keelson-rib-workiq/security/advisories/new>

A useful report includes:

- A description of the issue and the impact you observed (or believe is
  possible)
- The WorkIQ rib version, your Keelson version (`keelson version --json`),
  Bun version (`bun --version`), and OS where you reproduced it
- A minimal proof-of-concept or reproduction steps
- Any mitigations or workarounds you've found

I'll acknowledge new reports within **3 business days** and aim to have a
fix or mitigation plan within **14 days** of acknowledgement, faster for
issues with a public PoC or active exploitation. If a report turns out
to be out of scope, I'll explain why.

## Scope and threat model

WorkIQ is a **Keelson rib** — a capability package installed into the
Keelson harness and discovered at boot. It spawns the Microsoft WorkIQ
CLI (`workiq mcp`) as a child process and bridges its MCP tools — M365
Copilot queries and Microsoft Graph reads and mutations — into the
harness as chat tools. A rib runs with the same privileges as the
harness, so the threat model assumes:

- The operator trusts their own machine, the harness, and the ribs they
  install (vet a rib before installing it — a malicious rib is equivalent
  to malicious local code and is **outside** this threat model).
- Hostile inputs may arrive over the network inside M365 content: email
  bodies, meeting text, file contents, and Graph API responses all flow
  back through tool results into the model's context.

### In scope

- Command injection in the child-process launch: the rib splices
  `KEELSON_WORKIQ_COMMAND` / `KEELSON_WORKIQ_ARGS` and a PATH probe into
  a spawn — any path where remote or tool-supplied data (not just
  operator-set env) can influence what gets executed
- Credential or token leakage: any path where the rib logs, snapshots,
  or transmits M365 tokens or auth material (the rib is designed to
  never read or store any — WorkIQ manages auth out of band, so a
  regression here is a vulnerability)
- Mutation without intent flags: a bridged tool that can change M365
  state (send mail, create/update/delete Graph entities) reaching the
  agent without being flagged `state_changing`, bypassing the harness's
  UI gates

### Out of scope

- The Keelson harness itself (the OS keychain store, the server, the
  redaction engine) — report those at
  <https://github.com/danielscholl/keelson>
- The WorkIQ CLI and its token cache, the M365 Copilot service, and the
  Microsoft Graph API — please report those to Microsoft
- Prompt injection via M365 content steering the model (mitigate with
  the harness's confirmation gates on flagged tools; hardening the model
  against hostile context is a harness/provider concern)
- Behavior under a hostile rib (treat ribs as trusted code; vet them
  before installing them)
- Issues that require a hostile party to already have local code-
  execution or filesystem access on the operator's machine
- Cosmetic issues and denial-of-service via large inputs to local-only
  surfaces (file those as regular issues)

## Disclosure

After a fix lands and is released, I'll publish a GitHub security
advisory with a CVE if one is warranted, credit the reporter (unless
they prefer to stay anonymous), and link to the relevant commits and
release notes.
