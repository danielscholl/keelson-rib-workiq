import { describe, expect, test } from "bun:test";
import type { MessageChunk, ToolContext } from "@keelson/shared";
import { CONFIRM, MUTATING, toKeelsonTool } from "../src/bridge.ts";
import type { McpTool } from "../src/mcp-client.ts";

type ToolResult = Extract<MessageChunk, { type: "tool_result" }>;

function ctx(emits: MessageChunk[], signal?: AbortSignal): ToolContext {
  return {
    cwd: "/tmp",
    emit: (chunk) => emits.push(chunk),
    abortSignal: signal ?? new AbortController().signal,
  };
}

function mcpTool(overrides: Partial<McpTool> = {}): McpTool {
  return {
    name: "ask",
    description: "Ask M365 Copilot.",
    inputSchema: { type: "object", properties: {}, required: [] },
    ...overrides,
  };
}

describe("toKeelsonTool", () => {
  test("bridged names bucket under the workiq family", () => {
    const tool = toKeelsonTool(mcpTool(), async () => ({}));
    expect(tool.name).toBe("workiq_ask");
    expect(tool.description).toBe("Ask M365 Copilot.");
  });

  test("a missing upstream description gets a readable fallback", () => {
    const tool = toKeelsonTool(mcpTool({ description: undefined }), async () => ({}));
    expect(tool.description).toBe("WorkIQ ask");
  });

  test("mutating verbs and destructive-annotated tools are state_changing", () => {
    for (const name of MUTATING) {
      expect(toKeelsonTool(mcpTool({ name }), async () => ({})).state_changing).toBe(true);
    }
    const annotated = mcpTool({ annotations: { destructiveHint: true } });
    expect(toKeelsonTool(annotated, async () => ({})).state_changing).toBe(true);
  });

  test("consent-demanding tools require confirmation", () => {
    for (const name of CONFIRM) {
      expect(toKeelsonTool(mcpTool({ name }), async () => ({})).requires_confirmation).toBe(true);
    }
  });

  test("an unknown upstream tool bridges unflagged — discovery never breaks", () => {
    const tool = toKeelsonTool(mcpTool({ name: "some_future_tool" }), async () => ({}));
    expect(tool.state_changing).toBe(false);
    expect(tool.requires_confirmation).toBe(false);
    expect(tool.name).toBe("workiq_some_future_tool");
  });

  test("execute forwards name, args, and the abort signal to the call seam", async () => {
    const seen: { name?: string; args?: Record<string, unknown>; signal?: AbortSignal } = {};
    const controller = new AbortController();
    const tool = toKeelsonTool(mcpTool(), async (name, args, signal) => {
      Object.assign(seen, { name, args, signal });
      return { content: [{ type: "text", text: "ok" }] };
    });
    const emits: MessageChunk[] = [];
    await tool.execute({ prompt: "hello" }, ctx(emits, controller.signal));
    expect(seen.name).toBe("ask");
    expect(seen.args).toEqual({ prompt: "hello" });
    expect(seen.signal).toBe(controller.signal);
    const result = emits[0] as ToolResult;
    expect(result.type).toBe("tool_result");
    expect(result.content).toBe("ok");
    expect(result.isError).toBeUndefined();
  });

  test("execute coerces a null input to empty args", async () => {
    let seenArgs: Record<string, unknown> | undefined;
    const tool = toKeelsonTool(mcpTool(), async (_name, args) => {
      seenArgs = args;
      return { content: [] };
    });
    await tool.execute(null, ctx([]));
    expect(seenArgs).toEqual({});
  });

  test("an upstream error result emits isError without throwing", async () => {
    const tool = toKeelsonTool(mcpTool(), async () => ({
      isError: true,
      content: [{ type: "text", text: "denied" }],
    }));
    const emits: MessageChunk[] = [];
    await tool.execute({}, ctx(emits));
    const result = emits[0] as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toBe("denied");
  });

  test("a thrown call becomes an error tool_result, never an exception", async () => {
    const tool = toKeelsonTool(mcpTool(), async () => {
      throw new Error("boom");
    });
    const emits: MessageChunk[] = [];
    await tool.execute({}, ctx(emits));
    const result = emits[0] as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content).toBe("WorkIQ ask failed: boom");
  });
});
