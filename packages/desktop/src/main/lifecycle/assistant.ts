import { app } from "electron"
import { mkdirSync } from "node:fs"
import path from "node:path"

import { ASSISTANT_DIRECTORY_KEY } from "../storage/keys"
import { getStore } from "../storage/store"

// The assistant fork runs standalone chats out of one dedicated directory. Resolution must stay
// synchronous because windowBootstrap runs before any IPC port exists. But nothing may write
// userData app-state files (opencode.settings included) before first-launch detection, so reads
// and writes are split: windowBootstrap only reads, and the directory is created and stored after
// first-launch detection (upgrade) or when the first-launch onboarding completes (fresh install).
export const ASSISTANT_DIRECTORY_NAME = "Conversations"

export function readAssistantDirectory(): string | undefined {
  const stored = getStore().get(ASSISTANT_DIRECTORY_KEY)

  return typeof stored === "string" && stored.length > 0 ? stored : undefined
}

export function resolveAssistantDirectory(): string | undefined {
  const stored = readAssistantDirectory()

  if (stored) return stored

  try {
    const directory = path.join(app.getPath("documents"), ASSISTANT_DIRECTORY_NAME)
    mkdirSync(directory, { recursive: true })
    getStore().set(ASSISTANT_DIRECTORY_KEY, directory)

    return directory
  } catch {
    return undefined
  }
}
