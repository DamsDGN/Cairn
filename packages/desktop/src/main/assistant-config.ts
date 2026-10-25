import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { AssistantConfigResult, McpServerConfig } from "../shared/ipc-rpc/assistant"
import { writeAuthKey } from "./auth-file"
import { readAssistantDirectory } from "./lifecycle/assistant"
import { applyMcpServer, mcpServerNames } from "./mcp-config"
import { applyDefaultModel, applyProvider } from "./provider-config"

type Document = Record<string, unknown>

export function writeAssistantProvider(input: {
  id: string
  name: string
  baseURL: string
  apiKey?: string
  headers?: Record<string, string>
  models: ReadonlyArray<{ id: string; name: string }>
}): AssistantConfigResult {
  const directory = readAssistantDirectory()

  if (!directory) return { ok: false, error: "not-ready" }

  const file = path.join(directory, "opencode.json")

  try {
    const document = read(file)
    applyProvider(document, input)
    writeFileSync(file, JSON.stringify(document, null, "\t") + "\n")

    // A key typed in the form replaces the stored one; an empty field keeps whatever the provider
    // already had, so editing a provider does not silently drop its credential.
    if (input.apiKey) writeAuthKey(input.id, input.apiKey)

    return { ok: true, path: file }
  } catch (error) {
    return { ok: false, path: file, error: error instanceof TypeError ? "invalid-config" : "unknown" }
  }
}

export function writeAssistantDefaultModel(model: string | null): AssistantConfigResult {
  const directory = readAssistantDirectory()

  if (!directory) return { ok: false, error: "not-ready" }

  const file = path.join(directory, "opencode.json")

  try {
    const document = read(file)
    applyDefaultModel(document, model)
    writeFileSync(file, JSON.stringify(document, null, "\t") + "\n")

    return { ok: true, path: file }
  } catch (error) {
    return { ok: false, path: file, error: error instanceof TypeError ? "invalid-config" : "unknown" }
  }
}

// The default model the interface should show, when the Conversations folder sets one.
export function readAssistantDefaultModel(): string | undefined {
  const directory = readAssistantDirectory()

  if (!directory) return undefined

  try {
    const document = read(path.join(directory, "opencode.json"))
    const model = document.model

    return typeof model === "string" ? model : undefined
  } catch {
    return undefined
  }
}

// Only the servers this file declares, so the interface never offers to delete one that lives in the
// user-level configuration.
export function readAssistantMcpServers(): string[] {
  const directory = readAssistantDirectory()

  if (!directory) return []

  try {
    return mcpServerNames(read(path.join(directory, "opencode.json")))
  } catch {
    return []
  }
}

// MCP servers added from the app belong to the assistant folder: the seeded opencode.json is the
// document the server already reads for every standalone chat, so the entry survives a restart.
export function writeAssistantMcpServer(name: string, config: McpServerConfig | null): AssistantConfigResult {
  const directory = readAssistantDirectory()

  if (!directory) return { ok: false, error: "not-ready" }

  const file = path.join(directory, "opencode.json")

  try {
    const document = read(file)
    if (!applyMcpServer(document, name, config)) return { ok: false, path: file, error: "not-found" }
    writeFileSync(file, JSON.stringify(document, null, "\t") + "\n")

    return { ok: true, path: file }
  } catch (error) {
    return { ok: false, path: file, error: error instanceof TypeError ? "invalid-config" : "unknown" }
  }
}

function read(file: string): Document {
  if (!existsSync(file)) return {}

  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${file} is not a JSON object`)
  }

  return parsed as Document
}
