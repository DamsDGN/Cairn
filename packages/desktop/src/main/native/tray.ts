import { app, Menu, Tray } from "electron"
import path from "node:path"

import { getLastFocusedWindow } from "../windows"
import { nativeT, onNativeTranslations } from "./translations"

// The tray keeps the application reachable when the window is hidden or off screen. Its menu is
// rebuilt when the interface language changes, because the labels come from the same bundle as the
// native menu.
let tray: Tray | undefined

export function createTray() {
  const icon = path.join(app.getAppPath(), "resources", "icons", "32x32.png")

  try {
    tray = new Tray(icon)
  } catch (error) {
    console.log("[tray] unavailable", String(error))

    return
  }

  tray.setToolTip(app.getName())
  tray.on("click", showWindow)
  const apply = () => tray?.setContextMenu(Menu.buildFromTemplate(entries()))
  apply()
  onNativeTranslations(apply)
}

export function destroyTray() {
  tray?.destroy()
  tray = undefined
}

function showWindow() {
  const win = getLastFocusedWindow()

  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()

  win.show()
  win.focus()
}

function entries() {
  return [
    { label: nativeT("desktop.menu.showApp"), click: showWindow },
    { type: "separator" as const },
    { label: nativeT("desktop.menu.quit"), click: () => app.quit() },
  ]
}
