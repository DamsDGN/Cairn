import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

export type AuthEntry = { type: string; key?: string }

// Same file the CLI and the server read, so a provider connected from the app is visible to both.
export function authPath(): string {
  const dataHome = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share")

  return path.join(dataHome, "opencode", "auth.json")
}

export function readAuth(file = authPath()): Record<string, AuthEntry> {
  if (!existsSync(file)) return {}

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}

    return parsed as Record<string, AuthEntry>
  } catch {
    return {}
  }
}

// A null key removes the provider credential; the entry is dropped rather than left empty so the
// server never treats an empty key as configured.
export function writeAuthKey(provider: string, key: string | null, file = authPath()): void {
  const entries = readAuth(file)

  if (key) {
    entries[provider] = { type: "api", key }
  } else {
    delete entries[provider]
  }

  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(entries, null, "\t") + "\n", { mode: 0o600 })
}
