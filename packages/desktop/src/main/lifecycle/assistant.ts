import { app } from "electron"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
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
  try {
    const stored = readAssistantDirectory()
    const directory = stored ?? path.join(app.getPath("documents"), ASSISTANT_DIRECTORY_NAME)
    mkdirSync(directory, { recursive: true })
    seedAssistantProjectConfig(directory)

    if (!stored) getStore().set(ASSISTANT_DIRECTORY_KEY, directory)

    return directory
  } catch {
    return undefined
  }
}

// The generalist assistant runs from project config, not fork code: the persona, its permissions and
// the default agent are ordinary OpenCode configuration the user can inspect and edit by hand.
function seedAssistantProjectConfig(directory: string) {
  const file = path.join(directory, "opencode.json")

  if (existsSync(file)) return

  writeFileSync(
    file,
    JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        default_agent: "Assistant",
        agents: {
          Assistant: {
            description: "Assistant personnel polyvalent",
            mode: "primary",
            system: DISCUSSION_SYSTEM,
            permissions: [
              { action: "question", resource: "*", effect: "allow" },
              { action: "read", resource: `${directory}/**`, effect: "allow" },
              { action: "edit", resource: `${directory}/**`, effect: "allow" },
              { action: "websearch", resource: "*", effect: "allow" },
              { action: "webfetch", resource: "*", effect: "ask" },
            ],
          },
        },
      },
      null,
      "\t",
    ) + "\n",
  )
}

const DISCUSSION_SYSTEM = `Tu es un assistant personnel polyvalent, hors contexte développement.

Tu réponds de manière directe, concise et structurée, sans jargon inutile.
Tu réponds dans la langue de la personne ; si le message est ambigu, tu réponds en français.

Pour tout ce qui est lecture et écriture de fichiers ou d'actions web:
- Tu dis d'abord en une phrase ce que tu vas faire, puis tu le fais.
- Les outils te demandent une validation à la personne, tu peux compter dessus pour décider.

Tu peux ranger tes notes personnelles uniquement dans le répertoire du projet en cours de conversation.`
