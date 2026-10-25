import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "Cairn Dev",
  beta: "Cairn Beta",
  prod: "Cairn",
}

const appIDs: Record<string, string> = {
  dev: "tech.sover.cairn.dev",
  beta: "tech.sover.cairn.beta",
  prod: "tech.sover.cairn",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Cairn Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "tech.sover.cairn.dev"
