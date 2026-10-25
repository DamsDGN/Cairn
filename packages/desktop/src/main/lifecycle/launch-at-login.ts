import { app } from "electron"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { LAUNCH_AT_LOGIN_KEY } from "../storage/keys"
import { getStore } from "../storage/store"
import { autostartEntry, autostartFile } from "./autostart"

// macOS and Windows keep the login item themselves; Linux has no API, so the preference is written
// as a freedesktop autostart entry. The stored flag stays the source of truth for the setting.
export function readLaunchAtLogin() {
  return getStore().get(LAUNCH_AT_LOGIN_KEY) === true
}

export function writeLaunchAtLogin(enabled: boolean) {
  getStore().set(LAUNCH_AT_LOGIN_KEY, enabled)
  applyLaunchAtLogin(enabled)

  return enabled
}

export function applyLaunchAtLogin(enabled: boolean) {
  if (process.platform !== "linux") {
    app.setLoginItemSettings({ openAtLogin: enabled })

    return
  }

  const file = autostartFile()

  if (!enabled) {
    rmSync(file, { force: true })

    return
  }

  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, autostartEntry(autostartCommand()))
}

function autostartCommand() {
  if (app.isPackaged) return [process.env.APPIMAGE ?? process.execPath]

  // A dev checkout runs from the electron binary and needs the app directory to start.
  return [process.execPath, app.getAppPath()]
}

export function loginItemEnabled() {
  if (process.platform === "linux") return existsSync(autostartFile())

  return app.getLoginItemSettings().openAtLogin
}
