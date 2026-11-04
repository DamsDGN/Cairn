import { app, globalShortcut } from "electron"

import { QUICK_CAPTURE_ACCELERATOR } from "../constants"
import { getLastFocusedWindow } from "../windows"
import { sendMenuCommand } from "./menu"
import { showWindow } from "./show-window"

// The renderer owns the capture: the shortcut only brings the window forward and asks for a new
// conversation with dictation armed, over the same channel as the native menu.
export function registerQuickCapture() {
  if (!globalShortcut.register(QUICK_CAPTURE_ACCELERATOR, capture))
    console.log("[quick-capture] shortcut unavailable", QUICK_CAPTURE_ACCELERATOR)

  app.on("will-quit", () => globalShortcut.unregister(QUICK_CAPTURE_ACCELERATOR))
}

function capture() {
  const win = getLastFocusedWindow()

  if (!win || !showWindow(win)) return

  sendMenuCommand(win, "assistant.quickCapture")
}
