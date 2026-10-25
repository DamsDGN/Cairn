import type { McpServerConfig } from "../shared/ipc-rpc/assistant"

type Document = Record<string, unknown>

// Returns false when the server to remove is not configured, so the caller can report it.
export function applyMcpServer(document: Document, name: string, config: McpServerConfig | null): boolean {
  const mcp = record(document.mcp) ?? {}
  const servers = record(mcp.servers) ?? {}

  if (config) {
    servers[name] = config
  } else {
    if (!(name in servers)) return false
    delete servers[name]
  }

  if (Object.keys(servers).length > 0) mcp.servers = servers
  else delete mcp.servers

  if (Object.keys(mcp).length > 0) document.mcp = mcp
  else delete document.mcp

  return true
}

// Names declared in this document, so the interface only offers removal for servers it owns. A
// server from the user-level config belongs to that file, not to the assistant folder.
export function mcpServerNames(document: Document): string[] {
  const mcp = record(document.mcp)
  const servers = mcp ? record(mcp.servers) : undefined

  return servers ? Object.keys(servers) : []
}

function record(value: unknown): Document | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined

  return value as Document
}
