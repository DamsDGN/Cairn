import { expect, test } from "bun:test"

import { applyMcpServer } from "./mcp-config"

const remote = { type: "remote" as const, url: "https://example.com/mcp" }

test("adding a server keeps the existing configuration", () => {
  const document: Record<string, unknown> = { default_agent: "Assistant" }

  expect(applyMcpServer(document, "notes", remote)).toBe(true)
  expect(document).toEqual({ default_agent: "Assistant", mcp: { servers: { notes: remote } } })
})

test("adding a server preserves the other servers", () => {
  const document: Record<string, unknown> = { mcp: { servers: { first: remote } } }

  applyMcpServer(document, "second", { type: "local", command: ["npx", "-y", "server"] })
  expect(document).toEqual({
    mcp: {
      servers: {
        first: remote,
        second: { type: "local", command: ["npx", "-y", "server"] },
      },
    },
  })
})

test("adding over an existing name replaces it", () => {
  const document: Record<string, unknown> = { mcp: { servers: { notes: { type: "remote", url: "https://old" } } } }

  applyMcpServer(document, "notes", remote)
  expect(document).toEqual({ mcp: { servers: { notes: remote } } })
})

test("removing the last server drops the empty sections", () => {
  const document: Record<string, unknown> = { mcp: { servers: { notes: remote } }, default_agent: "Assistant" }

  expect(applyMcpServer(document, "notes", null)).toBe(true)
  expect(document).toEqual({ default_agent: "Assistant" })
})

test("removing an unknown server reports it", () => {
  const document: Record<string, unknown> = { mcp: { servers: { notes: remote } } }

  expect(applyMcpServer(document, "missing", null)).toBe(false)
  expect(document).toEqual({ mcp: { servers: { notes: remote } } })
})

test("other mcp fields survive an addition", () => {
  const document: Record<string, unknown> = { mcp: { servers: { notes: remote }, enabled: true } }

  applyMcpServer(document, "second", remote)
  expect(document).toEqual({ mcp: { enabled: true, servers: { notes: remote, second: remote } } })

  const broken: Record<string, unknown> = { mcp: "nope" }
  applyMcpServer(broken, "notes", remote)
  expect(broken).toEqual({ mcp: { servers: { notes: remote } } })
})
