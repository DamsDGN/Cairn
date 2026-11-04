import type { BrowserWindow } from "electron"

// Windows are created hidden. The tray, the deep links and the quick capture shortcut all need the
// same restore path, so they share it here instead of each keeping its own copy.
export function showWindow(win: BrowserWindow | null | undefined) {
  if (!win || win.isDestroyed()) return false

  if (win.isMinimized()) win.restore()

  win.show()
  win.focus()

  return true
}
