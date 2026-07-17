---
description: Prime understanding of the WorkIQ rib — the boot-time bridge, the three-module layout, and conventions
allowed-tools: Bash, Read, Glob, Grep
---

<prime-command>
  <objective>
    Build a working mental model of @keelson/rib-workiq — the bridge that turns
    Microsoft WorkIQ's MCP server into native keelson chat tools — fast enough to
    navigate it and respect its invariants before making a change. This is also
    keelson's teaching rib: how it is constructed IS the product.
  </objective>

  <constraints>
    <rule>Stay bounded. The whole src/ is three small files — read them all in
      full; that is the fastest route to the model here.</rule>
    <rule>DO NOT read test files — note their existence and count only.</rule>
    <rule>DO NOT launch subagents — this is a single-pass orientation.</rule>
    <rule>CLAUDE.md / AGENTS.md are already project context; build on them, don't re-read.</rule>
  </constraints>

  <phase number="1" name="orient">
    <step name="layout">
      <action>Map the package shape — directories and rough size.</action>
      <command>git ls-files | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn | head -20</command>
    </step>
    <step name="readme">
      <action>Read README.md.</action>
      <extract>The pitch: spawn `workiq mcp` once at boot, discover its tools
        dynamically, register each as `workiq_&lt;tool&gt;`; fail soft when WorkIQ is
        unreachable; auth is WorkIQ's problem, not the rib's.</extract>
    </step>
  </phase>

  <phase number="2" name="the-contract-surface">
    <intent>The rib is one Rib object assembled from three modules. Read all three, in this order.</intent>
    <step name="rib">
      <action>Read src/index.ts.</action>
      <extract>The exported `Rib` (registerTools + dispose); the boot-time
        discovery under top-level await (registerTools is synchronous, so
        discovery must finish at module load); the fail-soft try/catch that
        keeps a bad handshake from costing more than one boot; the intent
        flags (MUTATING / CONFIRM name sets) that gate M365 writes.</extract>
    </step>
    <step name="client">
      <action>Read src/mcp-client.ts.</action>
      <extract>Launch resolution order (env override → global `workiq` on PATH →
        npx fallback, and why the direct binary is preferred); the single
        idempotent connection with coalesced concurrent connects; the
        timeout-bounded connect and tool calls; the inherited env quirk for
        Windows PATH.</extract>
    </step>
    <step name="conversion">
      <action>Read src/json-schema.ts.</action>
      <extract>The pure layer: JSON-Schema → lenient zod (lenient BY INTENT —
        the harness parses arguments before the bridge, WorkIQ validates
        server-side); MCP CallToolResult → the single tool_result string.</extract>
    </step>
  </phase>

  <phase number="3" name="inventory">
    <step name="tests">
      <action>Count test files; report the count only.</action>
      <command>git ls-files 'test/**/*.test.ts' | wc -l</command>
    </step>
    <step name="roadmap">
      <action>Skim ROADMAP.md headings only — the planned capability milestones,
        each demonstrating another Rib-contract hook.</action>
      <command>grep '^#' ROADMAP.md 2>/dev/null</command>
    </step>
  </phase>

  <phase number="4" name="conventions">
    <action>Skim CONTRIBUTING.md for the rules that gate a PR.</action>
    <points>
      <point>Green before a PR: `bun run check`, `bun run typecheck`, `bun test`.</point>
      <point>Invariants: bridge stays dynamic (no hardcoded tool list); mutating
        tools stay flagged; fail soft at boot; schemas stay lenient; one child +
        bounded awaits; no credential handling; tests never spawn WorkIQ.</point>
      <point>Comments: default to none; capture non-obvious why; no narration.</point>
    </points>
  </phase>

  <phase number="5" name="summarize">
    <format>Concise markdown — no multi-page dump:</format>
    <sections>
      <section>Project: 1–2 sentences (a Keelson rib; the WorkIQ/M365 bridge; the teaching rib).</section>
      <section>The pipeline: boot handshake → tools/list → JSON-Schema→zod → ToolDefinition → call forwarding.</section>
      <section>Commands: test / typecheck / check / link:keelson.</section>
      <section>Invariants to respect for the change at hand (esp. dynamic discovery + intent flags).</section>
      <section>Where to start: which file to open first.</section>
    </sections>
  </phase>

  <anti-patterns>
    <avoid>Skipping the source because it "looks small" — the three files ARE the lesson.</avoid>
    <avoid>Launching subagents.</avoid>
    <avoid>A multi-page summary.</avoid>
  </anti-patterns>
</prime-command>
