import { createStore } from "solid-js/store"

const WIDTH_KEY = "opencode.assistant.sidebar.width"
const COLLAPSED_KEY = "opencode.assistant.sidebar.collapsed"
const SECTION_PREFIX = "opencode.assistant.sidebar.section."

export const SIDEBAR_DEFAULT_WIDTH = 264
export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 480
export const SIDEBAR_COLLAPSE_THRESHOLD = 150

export type SidebarSection = "projects" | "artifacts" | "recents"

const savedWidth = Number(localStorage.getItem(WIDTH_KEY))

const [assistantSidebar, setAssistantSidebar] = createStore({
  width:
    Number.isFinite(savedWidth) && savedWidth > 0
      ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, savedWidth))
      : SIDEBAR_DEFAULT_WIDTH,
  collapsed: localStorage.getItem(COLLAPSED_KEY) === "1",
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
