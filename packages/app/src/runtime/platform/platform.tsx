import { createSimpleContext } from "@opencode/ui/context"
import type { AsyncStorage, SyncStorage } from "@solid-primitives/storage"
import type { Accessor } from "solid-js"
import type { DesktopMenuAction } from "@/shell/commands/desktop-menu"
import type { DraftStore } from "@/runtime/persistence/drafts"
import type { Bridge } from "@opencode/gui-extensions/sdk/bridge"

type PickerPaths = string | string[] | null

type OpenDirectoryPickerOptions = { title?: string; multiple?: boolean }

type OpenAttachmentPickerOptions = {
  title?: string
  multiple?: boolean
  accept?: string[]
  extensions?: string[]
  defaultPath?: string
}

type SaveFilePickerOptions = { title?: string; defaultPath?: string }

type PlatformName = "web" | "desktop"

type DesktopOS = "macos" | "windows" | "linux"

export type GoUsageWindow = {
  status?: string
  percent: number
  resetsAt?: number
}

export type GoUsage = {
  rolling?: GoUsageWindow
  weekly?: GoUsageWindow
  monthly?: GoUsageWindow
}

export type FatalRendererErrorLog = {
  error: string
  url: string
  version?: string
  platform: PlatformName
  os?: DesktopOS
}

type PlatformBase = {
  /** App version */
  version?: string

  /** Open a web or mail URL in the default system application */
  openExternal(url: string): void

  /** Open an authentication page, reporting whether the browser could be launched. */
  openBrowser?(url: string): Promise<boolean>

  /** Open a local path in a local app (desktop only) */
  openPath?(path: string, app?: string): Promise<void>

  /** Open a local file URL in its default app (desktop only) */
  openLocalFile?(url: string): void

  /** Reveal a local path in the system file manager; false when the path does not exist (desktop only) */
  revealPath?(path: string): Promise<boolean>

  /** Restart the app  */
  restart(): Promise<void>

  /** Send a system notification */
  notify(title: string, description?: string, onClick?: () => void): Promise<void>

  /** Open a native attachment picker and read selected files sequentially (desktop only) */
  openAttachmentPickerDialog?<Value>(
    opts: OpenAttachmentPickerOptions,
    onFile: (file: File) => Promise<Value>,
  ): Promise<void>

  /** Resolve the native source path for a desktop File. */
  getPathForFile?(file: File): string

  /** Observe native drag cancellation that does not reach the renderer event loop. */
  onDragCancel?(callback: () => void): () => void

  /** Open a native save file dialog and write content to the selected path (desktop only) */
  saveFile?(opts: SaveFilePickerOptions, content: string): Promise<boolean>

  /** Storage mechanism, defaults to localStorage */
  storage?: (name?: string) => SyncStorage | AsyncStorage

  /** Prompt drafts, history, and their blobs. */
  draftStore?: DraftStore

  /** Fetch override */
  fetch?: typeof fetch

  /** Webview zoom level (desktop only) */
  webviewZoom?: Accessor<number>

  /** Whether the native desktop window is fullscreen */
  windowFullscreen?: Accessor<boolean>

  /** Whether the native desktop window is maximized (desktop only) */
  windowMaximized?: Accessor<boolean>

  /** Minimize the native desktop window */
  windowMinimize?(): void | Promise<void>

  /** Toggle maximize on the native desktop window */
  windowToggleMaximize?(): void | Promise<void>

  /** Close the native desktop window */
  windowClose?(): void | Promise<void>

  /** Get whether native pinch/Ctrl-scroll zoom gestures are enabled (desktop only) */
  getPinchZoomEnabled?(): Promise<boolean> | boolean

  /** Allow native pinch/Ctrl-scroll zoom gestures (desktop only) */
  setPinchZoomEnabled?(enabled: boolean): Promise<void> | void

  /** Run a desktop-only menu action from the app chrome */
  runDesktopMenuAction?(action: DesktopMenuAction): Promise<void> | void

  /** Check if an editor app exists (desktop only) */
  checkAppExists?(appName: string): Promise<boolean>

  /** Read image from clipboard (desktop only) */
  readClipboardImage?(): Promise<File | null>

  /** Write text to the native clipboard (desktop only) */
  writeClipboardText?(text: string): Promise<void>

  /** Export collected diagnostic logs (desktop only) */
  exportDebugLogs?(): Promise<string>

  /** Force focus styles on interactive elements through desktop devtools (desktop only) */
  setForceFocus?(enabled: boolean): Promise<void>

  /** Record a fatal renderer error in platform logs (desktop only) */
  recordFatalRendererError?(error: FatalRendererErrorLog): Promise<void>

  /** GUI extension bridge to the main-process extension host (desktop only). */
  extensions?: Bridge

  /** Root directory hosting the standalone chat sessions (desktop fork; undefined keeps the project-based flow). */
  assistantDirectory?: string

  /** Usage of the OpenCode Go subscription, null when it cannot be fetched (desktop fork). */
  goUsage?(): Promise<GoUsage | null>

  /** Persist MCP servers in the assistant folder configuration (desktop fork). */
  assistantMcp?: {
    add(server: string, config: AssistantMcpConfig): Promise<AssistantMcpResult>
    remove(server: string): Promise<AssistantMcpResult>
    list(): Promise<Array<string>>
  }

  /** Providers and the default model of the assistant folder (desktop fork). */
  assistantConfig?: {
    saveProvider(input: AssistantProviderInput): Promise<AssistantMcpResult>
    defaultModel(): Promise<string | undefined>
    setDefaultModel(model: string | null): Promise<AssistantMcpResult>
  }

  /** Start the application when the user signs in (desktop only). */
  launchAtLogin?: {
    get(): Promise<boolean>
    set(enabled: boolean): Promise<boolean>
  }

  /** On-device speech models, downloaded on request (desktop fork). */
  voiceLocal?: {
    models(): Promise<VoiceLocalModel[]>
    download(id: VoiceLocalModelID): Promise<VoiceLocalState>
    state(id: VoiceLocalModelID): Promise<VoiceLocalState>
    remove(id: VoiceLocalModelID): Promise<boolean>
    /** CPU kernel the local recognizer runs: AVX2, or the portable fallback. */
    acceleration(): Promise<{ level: VoiceLocalAcceleration }>
    preferences(): Promise<VoiceLocalPreferences>
    setPreferences(input: VoiceLocalPreferences): Promise<VoiceLocalPreferences>
    transcribe(input: {
      audio: ArrayBuffer
      language: string
      prompt?: string
      id?: VoiceLocalModelID
    }): Promise<string>
    /** Synthesizes speech on this machine and returns signed 16-bit mono PCM. */
    speak(input: { text: string; id?: VoiceLocalModelID }): Promise<{ audio: ArrayBuffer; sampleRate: number }>
  }
}

export type VoiceLocalModelID = "base-q5_1" | "small-q5_1" | "small" | "silero-v6.2.0" | "vits-piper-fr_FR-siwis-medium"

export type VoiceLocalAcceleration = "avx2" | "compatible"

export type VoiceLocalPreferences = { language?: string; prompt?: string }

export type VoiceLocalModel = {
  id: VoiceLocalModelID
  kind: "speech" | "detector" | "synthesis"
  installed: boolean
  size: number
}

export type VoiceLocalState = {
  id: VoiceLocalModelID
  status: "idle" | "downloading" | "installed" | "failed"
  received: number
  total: number
}

export type AssistantMcpConfig =
  | { type: "remote"; url: string; headers?: Record<string, string> }
  | { type: "local"; command: string[]; environment?: Record<string, string> }

export type AssistantProviderInput = {
  id: string
  name: string
  baseURL: string
  apiKey?: string
  headers?: Record<string, string>
  models: Array<{ id: string; name: string }>
}

export type AssistantMcpResult = {
  ok: boolean
  path?: string
  error?: "not-ready" | "invalid-config" | "not-found" | "unknown"
}

export type Platform = PlatformBase &
  (
    | { platform: "web"; os?: never; windowID?: never }
    | {
        platform: "desktop"
        os?: DesktopOS
        /** Stable platform window identity for window-scoped persistence */
        windowID: string
        openDirectoryPickerDialog(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>
      }
  )

export const { use: usePlatform, provider: PlatformProvider } = createSimpleContext({
  name: "Platform",
  init: (props: { value: Platform }) => {
    return props.value
  },
})
