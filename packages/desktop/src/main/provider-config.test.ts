import { expect, test } from "bun:test"

import { applyDefaultModel, applyProvider, OPENAI_COMPATIBLE_PACKAGE } from "./provider-config"

const input = {
  id: "atlas",
  name: "Atlas",
  baseURL: "https://ai.sover.lan/v1",
  models: [{ id: "sover-llm", name: "Sover LLM" }],
}

test("a provider is written in the openai-compatible shape", () => {
  const document: Record<string, unknown> = { default_agent: "Assistant" }

  applyProvider(document, input)

  expect(document).toEqual({
    default_agent: "Assistant",
    providers: {
      atlas: {
        name: "Atlas",
        package: OPENAI_COMPATIBLE_PACKAGE,
        settings: { baseURL: "https://ai.sover.lan/v1" },
        models: { "sover-llm": { name: "Sover LLM" } },
      },
    },
  })
})

test("editing a provider keeps its package and other settings", () => {
  const document: Record<string, unknown> = {
    providers: {
      atlas: {
        name: "Atlas",
        package: "@ai-sdk/custom",
        settings: { baseURL: "https://old/v1", timeout: 30 },
        models: { other: { name: "Other" } },
      },
    },
  }

  applyProvider(document, input)

  const providers = document.providers as Record<string, Record<string, unknown>>
  expect(providers.atlas.package).toBe("@ai-sdk/custom")
  expect(providers.atlas.settings).toEqual({ baseURL: "https://ai.sover.lan/v1", timeout: 30 })
  expect(providers.atlas.models).toEqual({ other: { name: "Other" }, "sover-llm": { name: "Sover LLM" } })
})

test("headers are only written when provided", () => {
  const document: Record<string, unknown> = {}

  applyProvider(document, input)
  expect((document.providers as Record<string, Record<string, unknown>>).atlas.headers).toBeUndefined()

  applyProvider(document, { ...input, headers: { "X-Tenant": "sover" } })
  expect((document.providers as Record<string, Record<string, unknown>>).atlas.headers).toEqual({
    "X-Tenant": "sover",
  })
})

test("the default model is set and cleared", () => {
  const document: Record<string, unknown> = { default_agent: "Assistant" }

  applyDefaultModel(document, "atlas/sover-llm")
  expect(document.model).toBe("atlas/sover-llm")

  applyDefaultModel(document, null)
  expect(document.model).toBeUndefined()
  expect(document.default_agent).toBe("Assistant")
})
