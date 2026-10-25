import type { Platform } from "@opencode/app/desktop"
import type { ElectronAPI } from "../api-types"
import { setPinchZoomEnabled, webviewZoom } from "../window/zoom"
import { windowFullscreen } from "../window/fullscreen"
import { windowMaximized } from "../window/maximized"
import { DragCancelEvent } from "../../shared/ipc-transport"
import { createExtensionBridge } from "../extensions"
import { createDesktopFiles } from "./files"
import { createDesktopMenuAction } from "./menu"
import { createDesktopNotify } from "./notifications"
import { createDesktopStorage } from "./storage"

export type DesktopWindowState = {
  id: string
  version: string
  assistantDirectory?: string
}

export function createDesktopPlatform(api: ElectronAPI, windowState: DesktopWindowState): Platform {
  const os = desktopOS()

  return {
    platform: "desktop",
    os,
    version: windowState.version,
    windowID: windowState.id,
    assistantDirectory: windowState.assistantDirectory,
    goUsage: () => api.goUsage(),
    assistantMcp: {
      add: (server, config) => api.assistantMcpAdd(server, config),
      remove: (server) => api.assistantMcpRemove(server),
      list: () => api.assistantMcpList(),
    },
    assistantConfig: {
      saveProvider: (input) => api.assistantProviderSave(input),
      defaultModel: () => api.assistantDefaultModel(),
      setDefaultModel: (model) => api.assistantDefaultModelSet(model),
    },
    launchAtLogin: {
      get: () => api.launchAtLoginGet(),
      set: (enabled) => api.launchAtLoginSet(enabled),
    },
    voiceLocal: {
      models: () => api.voiceModelList().then((result) => result.models),
      download: (id) => api.voiceModelDownload(id),
      state: (id) => api.voiceModelState(id),
      remove: (id) => api.voiceModelRemove(id),
      acceleration: () => api.voiceAcceleration(),
      preferences: () => api.voicePreferences(),
      setPreferences: (input) => api.voicePreferencesSet(input),
      transcribe: (input) => api.voiceTranscribe(input),
    },
    ...createDesktopFiles(api, os),
    ...createDesktopStorage(api),
    exportDebugLogs: () => api.exportDebugLogs(),
    setForceFocus: (enabled) => api.setForceFocus(enabled),
    recordFatalRendererError: (error) => api.recordFatalRendererError(error),
    restart: async () => api.relaunch(),
    notify: createDesktopNotify(api),
    fetch: (input, init) => {
      if (input instanceof Request) return fetch(input)

      return fetch(input, init)
    },
    webviewZoom,
    windowFullscreen,
    windowMaximized,
    windowMinimize: () => api.minimizeWindow(),
    windowToggleMaximize: async () => {
      await api.toggleWindowMaximize()
    },
    windowClose: () => api.closeWindow(),
    getPinchZoomEnabled: () => api.getPinchZoomEnabled(),
    setPinchZoomEnabled,
    onDragCancel: (callback) => {
      window.addEventListener(DragCancelEvent, callback)

      return () => window.removeEventListener(DragCancelEvent, callback)
    },
    runDesktopMenuAction: createDesktopMenuAction(api),
    checkAppExists: async (appName) => {
      return api.checkAppExists(appName)
    },
    extensions: createExtensionBridge(),
  }
}

function desktopOS() {
  if (navigator.userAgent.includes("Mac")) return "macos"

  if (navigator.userAgent.includes("Windows")) return "windows"

  if (navigator.userAgent.includes("Linux")) return "linux"

  return undefined
}
