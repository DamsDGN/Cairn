import { createStore } from "solid-js/store"

const WIDTH_KEY = "opencode.assistant.sidebar.width"
const COLLAPSED_KEY = "opencode.assistant.sidebar.collapsed"
const PINNED_KEY = "opencode.assistant.sidebar.pinned"
const OPENED_KEY = "opencode.assistant.sidebar.opened"
const SECTION_PREFIX = "opencode.assistant.sidebar.section."

/** Keeps the rail bounded while covering every conversation ever opened in the app. */
const OPENED_LIMIT = 300

export const SIDEBAR_DEFAULT_WIDTH = 264
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_COLLAPSE_THRESHOLD = 150

export type SidebarSection = "projects" | "artifacts" | "recents"

const savedWidth = Number(localStorage.getItem(WIDTH_KEY))

const readIDs = (key: string) => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")

    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === "string")
  } catch {
    return []
  }
}

const [assistantSidebar, setAssistantSidebar] = createStore({
  width:
    Number.isFinite(savedWidth) && savedWidth > 0
      ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, savedWidth))
      : SIDEBAR_DEFAULT_WIDTH,
  collapsed: localStorage.getItem(COLLAPSED_KEY) === "1",
  pinned: readIDs(PINNED_KEY),
  opened: readIDs(OPENED_KEY),
  sections: {
    projects: localStorage.getItem(`${SECTION_PREFIX}projects`) === "1",
    artifacts: localStorage.getItem(`${SECTION_PREFIX}artifacts`) === "1",
    recents: localStorage.getItem(`${SECTION_PREFIX}recents`) !== "0",
  },
})

export { assistantSidebar }

export const persistSidebarWidth = (width: number) => {
  const value = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))

  setAssistantSidebar("width", value)
  localStorage.setItem(WIDTH_KEY, String(value))
}

export const persistSidebarCollapsed = (collapsed: boolean) => {
  setAssistantSidebar("collapsed", collapsed)
  localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0")
}

export const toggleSidebarCollapsed = () => {
  persistSidebarCollapsed(!assistantSidebar.collapsed)
}

export const toggleSidebarSection = (key: SidebarSection) => {
  setAssistantSidebar("sections", key, !assistantSidebar.sections[key])
  localStorage.setItem(`${SECTION_PREFIX}${key}`, assistantSidebar.sections[key] ? "1" : "0")
}

export const isSessionPinned = (sessionID: string) => assistantSidebar.pinned.includes(sessionID)

/** True once the conversation has been opened in Cairn, current session or an earlier run included. */
export const isSessionOpened = (sessionID: string) => assistantSidebar.opened.includes(sessionID)

export const rememberSessionOpened = (sessionID: string) => {
  if (isSessionOpened(sessionID)) return
  const opened = [sessionID, ...assistantSidebar.opened].slice(0, OPENED_LIMIT)

  setAssistantSidebar("opened", opened)
  localStorage.setItem(OPENED_KEY, JSON.stringify(opened))
}

export const toggleSessionPinned = (sessionID: string) => {
  const pinned = assistantSidebar.pinned.includes(sessionID)
    ? assistantSidebar.pinned.filter((id) => id !== sessionID)
    : [sessionID, ...assistantSidebar.pinned]

  setAssistantSidebar("pinned", pinned)
  localStorage.setItem(PINNED_KEY, JSON.stringify(pinned))
}
