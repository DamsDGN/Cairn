import { app, Menu, Tray } from "electron"
import path from "node:path"

import { QUICK_CAPTURE_ACCELERATOR } from "../constants"
import { getLastFocusedWindow } from "../windows"
import { sendMenuCommand } from "./menu"
import { showWindow } from "./show-window"
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
  tray.on("click", () => showWindow(getLastFocusedWindow()))
  const apply = () => tray?.setContextMenu(Menu.buildFromTemplate(entries()))
  apply()
  onNativeTranslations(apply)
}

export function destroyTray() {
  tray?.destroy()
  tray = undefined
}

function entries() {
  return [
    { label: nativeT("desktop.menu.showApp"), click: () => showWindow(getLastFocusedWindow()) },
    { type: "separator" as const },
    // The renderer owns both actions; the tray only forwards them like the native menu does.
    { label: nativeT("desktop.menu.newChat"), click: () => run("tab.new") },
    {
      label: nativeT("desktop.menu.quickCapture"),
      // The shortcut itself is registered globally; this only shows it next to the item.
      accelerator: QUICK_CAPTURE_ACCELERATOR,
      registerAccelerator: false,
      click: () => run("assistant.quickCapture"),
    },
    { type: "separator" as const },
    { label: nativeT("desktop.menu.quit"), click: () => app.quit() },
  ]
}

function run(id: string) {
  const win = getLastFocusedWindow()

  if (!win || !showWindow(win)) return

  sendMenuCommand(win, id)
}
