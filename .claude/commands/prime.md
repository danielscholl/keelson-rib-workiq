---
description: Prime understanding of the WorkIQ rib — the boot-time bridge, the module layout, and conventions
allowed-tools: Bash, Read, Glob, Grep
---

<prime-command>
  <objective>
    Build a working, current mental model of @keelson/rib-workiq — the bridge
    that turns Microsoft WorkIQ's MCP server into native keelson chat tools —
    fast enough to navigate it and respect its invariants before making a
    change. This is also keelson's teaching rib: how it is constructed IS the
    product. AGENTS.md (already in context) carries the stable contract,
    patterns, and invariants; this command's job is to discover what is true
    RIGHT NOW from the code itself. Report only what you derived this pass;
    never recall a module list or flagged-tool set from memory or from a doc.
  </objective>

  <constraints>
    <rule>src/ is small — derive the file list with ls and read EVERY source
      file in full; that is the fastest route to the model here.</rule>
    <rule>DO NOT read test files — count them only.</rule>
    <rule>DO NOT launch subagents — this is a single-pass orientation.</rule>
    <rule>AGENTS.md / CLAUDE.md are already project context; build on them,
      don't re-read them. The code is the truth. If something you read
      materially contradicts AGENTS.md or a docs/ page, note it in ONE closing
      line and move on — auditing docs is not this command's job.</rule>
  </constraints>

  <phase number="1" name="orient">
    <step name="layout">
      <action>Map the package shape and get the real module list.</action>
      <command>git ls-files | sed 's#/[^/]*$##' | sort | uniq -c | sort -rn | head -20</command>
      <command>wc -l src/*.ts</command>
    </step>
    <step name="readme">
      <action>Read README.md.</action>
      <learn>The current pitch: how the bridge boots, what it requires, and
        whose problem auth is.</learn>
    </step>
  </phase>

  <phase number="2" name="the-contract-surface">
    <intent>The rib is one Rib object assembled from the modules you just
      listed. Read them all — start from src/index.ts and follow its imports.</intent>
    <step name="source">
      <action>Read every file in src/, index.ts first.</action>
      <learn>What the exported `Rib` contributes today, and why discovery runs
        at module load rather than in registerTools.</learn>
      <learn>Where the fail-soft boundary sits and what a failed handshake
        costs.</learn>
      <learn>Which upstream tools are currently flagged mutating or
        consent-gated, and what happens to an upstream name the intent sets
        don't know.</learn>
      <learn>How the connection is launched, reused, and bounded (env
        overrides, timeouts, abort forwarding).</learn>
      <learn>Why the schema conversion is lenient by intent, and how a tool
        failure reaches the agent.</learn>
    </step>
  </phase>

  <phase number="3" name="inventory">
    <intent>Derive every number and list you will report — from these commands
      and the reads above, not from AGENTS.md, docs/, or memory.</intent>
    <command>git ls-files 'test/**/*.test.ts' | wc -l   # test files</command>
    <command>grep '^#' ROADMAP.md 2>/dev/null           # planned Rib-contract milestones</command>
    <command>ls .claude/commands/ 2>/dev/null</command>
  </phase>

  <phase number="4" name="conventions">
    <action>Skim CONTRIBUTING.md for the rules that gate a PR — the required
      checks, commit/PR-title format, and architecture rules.</action>
  </phase>

  <phase number="5" name="summarize">
    <format>Concise markdown — no multi-page dump. Every list and count must
      come from this pass's commands and reads.</format>
    <sections>
      <section>Project: 1–2 sentences (the WorkIQ/M365 bridge; the teaching rib).</section>
      <section>The pipeline: boot handshake → tools/list → per-tool conversion →
        ToolDefinition → call forwarding, as currently implemented.</section>
      <section>The module layout as it exists right now, one role per file.</section>
      <section>Commands: the package scripts that gate a PR.</section>
      <section>Invariants bearing on the change at hand (esp. dynamic discovery
        + intent flags), from AGENTS.md, confirmed against what you just read.</section>
      <section>Where to start: which file to open first for this task.</section>
      <section>Only if found: one closing line naming any material contradiction
        between the code and AGENTS.md / docs/.</section>
    </sections>
  </phase>

  <anti-patterns>
    <avoid>Skipping the source because it "looks small" — the files ARE the lesson.</avoid>
    <avoid>Reporting a module list or flagged-tool set you did not derive this pass.</avoid>
    <avoid>Turning orientation into a docs audit — one closing drift line at most.</avoid>
    <avoid>Launching subagents. A multi-page summary.</avoid>
  </anti-patterns>
</prime-command>
