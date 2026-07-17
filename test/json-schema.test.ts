import { describe, expect, test } from "bun:test";
import { inputSchemaToZod, serializeToolResult } from "../src/json-schema.ts";

describe("inputSchemaToZod", () => {
  test("object schema: required props required, optional props optional", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: {
        prompt: { type: "string" },
        limit: { type: "number" },
      },
      required: ["prompt"],
    });
    expect(zod.safeParse({ prompt: "hi" }).success).toBe(true);
    expect(zod.safeParse({ prompt: "hi", limit: 3 }).success).toBe(true);
    expect(zod.safeParse({}).success).toBe(false);
    expect(zod.safeParse({ prompt: 42 }).success).toBe(false);
  });

  test("extra keys pass through — WorkIQ validates server-side", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    });
    expect(zod.safeParse({ path: "/me/messages", stray: true }).success).toBe(true);
  });

  test("defaults make a field satisfiable when omitted, and fill the value", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: { count: { type: "number", default: 10 } },
      required: [],
    });
    const parsed = zod.safeParse({});
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { count: number } }).data.count).toBe(10);
  });

  test("nullable union types accept null", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: { filter: { type: ["string", "null"] } },
      required: ["filter"],
    });
    expect(zod.safeParse({ filter: null }).success).toBe(true);
    expect(zod.safeParse({ filter: "x" }).success).toBe(true);
  });

  test("arrays and nested objects convert recursively", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" } },
        options: {
          type: "object",
          properties: { top: { type: "integer" } },
          required: ["top"],
        },
      },
      required: ["paths"],
    });
    expect(zod.safeParse({ paths: ["a", "b"] }).success).toBe(true);
    expect(zod.safeParse({ paths: [1] }).success).toBe(false);
    expect(zod.safeParse({ paths: [], options: { top: 5 } }).success).toBe(true);
    expect(zod.safeParse({ paths: [], options: {} }).success).toBe(false);
  });

  test("untyped nodes accept anything — WorkIQ's jsonBody is untyped upstream", () => {
    const zod = inputSchemaToZod({
      type: "object",
      properties: { jsonBody: {} },
      required: ["jsonBody"],
    });
    expect(zod.safeParse({ jsonBody: { any: ["thing"] } }).success).toBe(true);
    expect(zod.safeParse({ jsonBody: "text" }).success).toBe(true);
  });

  test("a missing or non-object schema falls back to a permissive object", () => {
    for (const schema of [undefined, null, "not-a-schema", 42]) {
      const zod = inputSchemaToZod(schema);
      expect(zod.safeParse({ whatever: 1 }).success).toBe(true);
    }
  });
});

describe("serializeToolResult", () => {
  test("joins text blocks in order", () => {
    const { content, isError } = serializeToolResult({
      content: [
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ],
    });
    expect(content).toBe("first\nsecond");
    expect(isError).toBe(false);
  });

  test("serializes non-text blocks and structured content as JSON", () => {
    const { content } = serializeToolResult({
      content: [{ type: "image", data: "abc" }],
      structuredContent: { conversationId: "c1" },
    });
    expect(content).toContain('"type":"image"');
    expect(content).toContain('"conversationId":"c1"');
  });

  test("propagates the error flag with a fallback message for empty content", () => {
    const err = serializeToolResult({ isError: true, content: [] });
    expect(err.isError).toBe(true);
    expect(err.content).toBe("WorkIQ tool returned an error.");

    const ok = serializeToolResult({ content: [] });
    expect(ok.isError).toBe(false);
    expect(ok.content).toBe("");
  });

  test("tolerates a bare-string content field", () => {
    expect(serializeToolResult({ content: "plain" }).content).toBe("plain");
  });
});
