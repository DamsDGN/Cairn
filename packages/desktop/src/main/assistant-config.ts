import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { AssistantConfigResult, McpServerConfig } from "../shared/ipc-rpc/assistant"
import { readAssistantDirectory } from "./lifecycle/assistant"
import { applyMcpServer, mcpServerNames } from "./mcp-config"

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

function read(file: string): Record<string, unknown> {
  if (!existsSync(file)) return {}

  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError(`${file} is not a JSON object`)
  }

  return parsed as Record<string, unknown>
}
