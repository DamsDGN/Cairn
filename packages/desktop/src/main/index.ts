// Imported first so its evaluation stamps the moment Electron handed control to this module.
import { marks } from "./lifecycle/marks"
import { app } from "electron"
import { acquireApplicationLock, configureApplication } from "./lifecycle/configure"
import { startSidecarProbe } from "./service/sidecar-probe"
import { registerStorageSnapshotHandler } from "./storage/snapshot"
import { createEarlyWindow } from "./windows/early"
import { rendererAssetsServed } from "./windows/protocol"
import { registerRendererScheme } from "./windows/scheme"

// This module stays small on purpose. Electron holds the ready event until the entry module has
// finished, and the first window should be on screen before the rest of the main process — a few
// hundred milliseconds of module evaluation and layers — loads. Configuration and the scheme must
// precede ready; the window is created the moment ready fires; everything else is imported after.
configureApplication()

if (acquireApplicationLock()) {
  registerRendererScheme()
  // Window first, then the bundle: starting the import before ready delays ready itself, because the
  // module graph evaluates on the same thread Chromium needs to finish initialising.
  void app.whenReady().then(async () => {
    marks.ready = Date.now()
    registerStorageSnapshotHandler()
    createEarlyWindow()
    marks.window = Date.now()
    startSidecarProbe()

    const tray = await import("./native/tray")
    tray.createTray()

    // The recognizer loads its model in the background once the window is up, so the first
    // dictation does not wait for it. A machine without a model does nothing.
    const voice = await import("./voice/transcribe")
    setTimeout(() => voice.preload(app.getPath("userData")), 4000)

    // The login item lives in the OS (or an autostart entry on Linux), so it is re-applied at every
    // start: a profile restored from a backup, or a system that dropped the entry, converges.
    const launchAtLogin = await import("./lifecycle/launch-at-login")
    launchAtLogin.applyLaunchAtLogin(launchAtLogin.readLaunchAtLogin())

    // The window's renderer is already loading. Its HTML and preloaded chunks are served from this
    // thread, so the bundle waits for that burst to be answered (or a cap) before it evaluates.
    if (!process.env.ELECTRON_RENDERER_URL) await rendererAssetsServed({ quietMs: 40, capMs: 400 })
    marks.served = Date.now()

    return import("./desktop")
  })
}
