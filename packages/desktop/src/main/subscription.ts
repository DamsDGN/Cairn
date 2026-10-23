import type { GoUsage, GoUsageWindow } from "@opencode/app/desktop"
import { net } from "electron"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

// Public usage endpoint of the OpenCode Go subscription; no first-class API exists upstream.
const USAGE_URL = "https://opencode.ai/zen/go/v1/usage"
const USAGE_TTL = 60_000

const authPath = () => {
  const dataHome = process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share")
  return path.join(dataHome, "opencode", "auth.json")
}

const KEY_ENV_VARS = ["OPENCODE_GO_API_KEY", "OPENCODE_API_KEY", "OPENCODE_ZEN_API_KEY"]

function readGoKey() {
  for (const name of KEY_ENV_VARS) {
    const value = process.env[name]?.trim()
    if (value) return value
  }

  try {
    const parsed = JSON.parse(readFileSync(authPath(), "utf8")) as Record<string, Record<string, unknown>>
    const item = parsed["opencode-go"] ?? parsed["opencode"]
    return typeof item?.key === "string" ? item.key.trim() : ""
  } catch {
    return ""
  }
}

function pickWindow(value: unknown): GoUsageWindow | undefined {
  if (typeof value !== "object" || value === null) return
  const data = value as Record<string, unknown>
  const percent =
    typeof data.percent === "number"
      ? data.percent
      : typeof data.percent === "string" && Number.isFinite(Number(data.percent))
        ? Number(data.percent)
        : undefined
  if (percent === undefined) return
  const resetsAt =
    typeof data.resetsAt === "number"
      ? data.resetsAt
      : typeof data.resetsAt === "string" && data.resetsAt
        ? Date.parse(data.resetsAt)
        : undefined
  return {
    ...(typeof data.status === "string" && data.status ? { status: data.status } : {}),
    percent,
    ...(resetsAt !== undefined && Number.isFinite(resetsAt) && resetsAt > 0 ? { resetsAt } : {}),
  }
}

function parseUsage(value: unknown): GoUsage | undefined {
  if (typeof value !== "object" || value === null) return
  const usage = (value as Record<string, unknown>).usage
  if (typeof usage !== "object" || usage === null) return
  const windows = {
    rolling: pickWindow((usage as Record<string, unknown>).rolling),
    weekly: pickWindow((usage as Record<string, unknown>).weekly),
    monthly: pickWindow((usage as Record<string, unknown>).monthly),
  }

  if (!windows.rolling && !windows.weekly && !windows.monthly) return
  return cleanup(windows)
}

function cleanup(windows: GoUsage) {
  return {
    ...(windows.rolling ? { rolling: windows.rolling } : {}),
    ...(windows.weekly ? { weekly: windows.weekly } : {}),
    ...(windows.monthly ? { monthly: windows.monthly } : {}),
  }
}

let cache: { at: number; usage: GoUsage } | undefined

export async function fetchGoUsage(): Promise<GoUsage | null> {
  const key = readGoKey()
  if (!key) return null
  if (cache && Date.now() - cache.at < USAGE_TTL) return cache.usage

  try {
    const response = await net.fetch(USAGE_URL, { headers: { Authorization: `Bearer ${key}` } })
    if (!response.ok) return null
    const usage = parseUsage(await response.json())
    if (!usage) return null
    cache = { at: Date.now(), usage }
    return usage
  } catch {
    return null
  }
}
