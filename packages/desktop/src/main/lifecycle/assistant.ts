import { app } from "electron"
import { mkdirSync } from "node:fs"
import path from "node:path"

import { ASSISTANT_DIRECTORY_KEY } from "../storage/keys"
import { getStore } from "../storage/store"

// The assistant fork runs standalone chats out of one dedicated directory. Resolution must stay
// synchronous: windowBootstrap runs before any IPC port exists.
export function assistantDirectory(): string | undefined {
  const stored = getStore().get(ASSISTANT_DIRECTORY_KEY)

  if (typeof stored === "string" && stored.length > 0) return stored

  try {
    const directory = path.join(app.getPath("documents"), "Conversations")
    mkdirSync(directory, { recursive: true })
    getStore().set(ASSISTANT_DIRECTORY_KEY, directory)

    return directory
  } catch {
    return undefined
  }
}
