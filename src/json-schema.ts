// Copyright 2026, Daniel Scholl
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { z } from "zod";

type JsonSchema = Record<string, unknown>;

function typesOf(node: JsonSchema): string[] {
  const t = node.type;
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  if (typeof t === "string") return [t];
  return [];
}

function itemSchema(node: JsonSchema): z.ZodTypeAny {
  const items = node.items;
  return items && typeof items === "object" ? nodeToZod(items as JsonSchema) : z.unknown();
}

function baseType(node: JsonSchema): z.ZodTypeAny {
  const primary = typesOf(node).find((t) => t !== "null");
  switch (primary) {
    case "string":
      return z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(itemSchema(node));
    case "object": {
      if (node.properties && typeof node.properties === "object") return objectToZod(node);
      const ap = node.additionalProperties;
      const value = ap && typeof ap === "object" ? nodeToZod(ap as JsonSchema) : z.unknown();
      return z.record(z.string(), value);
    }
    default:
      // No declared type (e.g. WorkIQ's untyped `jsonBody`) — accept anything.
      return z.unknown();
  }
}

function nodeToZod(node: JsonSchema): z.ZodTypeAny {
  let schema = baseType(node);
  if (typesOf(node).includes("null")) schema = schema.nullable();
  if (typeof node.description === "string") schema = schema.describe(node.description);
  if ("default" in node) schema = schema.default(node.default);
  return schema;
}

function objectToZod(node: JsonSchema): z.ZodTypeAny {
  const props = (node.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set<string>(Array.isArray(node.required) ? node.required : []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, propNode] of Object.entries(props)) {
    let field = nodeToZod(propNode);
    // A defaulted or non-required field is satisfiable when the model omits it.
    if (!required.has(key) && !("default" in propNode)) field = field.optional();
    shape[key] = field;
  }
  // Tolerate extra keys rather than rejecting a valid call over a stray field —
  // WorkIQ validates arguments server-side.
  return z.object(shape).catchall(z.unknown());
}

// Convert an MCP tool's JSON-Schema `inputSchema` into a lenient zod schema.
// Lenient by intent: the provider `.parse()`s arguments before calling the
// bridge, so a too-strict schema would reject calls WorkIQ would have accepted.
export function inputSchemaToZod(schema: unknown): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") return z.object({}).catchall(z.unknown());
  const node = schema as JsonSchema;
  if (typesOf(node).includes("object") || node.properties) return objectToZod(node);
  return nodeToZod(node);
}

// Flatten an MCP `CallToolResult` into the single string a keelson `tool_result`
// carries. Text blocks join in order; a non-text block and any structured
// content (e.g. WorkIQ's `conversationId` for multi-turn `ask`) serialize as JSON.
export function serializeToolResult(result: unknown): { content: string; isError: boolean } {
  const r = (result ?? {}) as Record<string, unknown>;
  const isError = r.isError === true;
  const parts: string[] = [];
  const content = r.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        if (it.type === "text" && typeof it.text === "string") parts.push(it.text);
        else parts.push(JSON.stringify(it));
      }
    }
  } else if (typeof content === "string") {
    parts.push(content);
  }
  if (r.structuredContent && typeof r.structuredContent === "object") {
    parts.push(JSON.stringify(r.structuredContent));
  }
  const text = parts.join("\n").trim();
  return { content: text || (isError ? "WorkIQ tool returned an error." : ""), isError };
}
