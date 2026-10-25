import type { SessionInfo } from "@opencode/client/promise"
import type { GoUsage, GoUsageWindow } from "@/runtime/platform/platform"
import { skipToken, useQuery } from "@tanstack/solid-query"
import { Button } from "@opencode/ui/button"
import { IconButton } from "@opencode/ui/icon-button"
import { Icon } from "@opencode/ui/icon"
import type { IconName } from "@opencode/ui/icons/catalog"
import { Menu } from "@opencode/ui/menu"
import { TextInput } from "@opencode/ui/text-input"
import { InlineInput } from "@opencode/ui/inline-input"
import { ScrollView } from "@opencode/ui/scroll-view"
import { ResizeHandle } from "@opencode/ui/resize-handle"
import { Dialog, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import {
  For,
  Show,
  createMemo,
  createResource,
  createSignal,
  startTransition,
  type JSX,
} from "solid-js"
import { debounce } from "@solid-primitives/scheduled"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useServerCtx } from "@/runtime/server/runtime"
import { sessionLabel } from "@/session/title"
import { useSettingsSurface } from "@/settings/surface"
import { useTabs } from "@/shell/tabs/tabs"
import { useCurrentRoute, type LocalProject } from "@/shell/state/layout"
import { useSessionTabAvatarState } from "@/shell/layout/project-avatar-state"
import { notifySessionTabsRemoved } from "@/shell/titlebar/session-events"
import { sessionTreeIDs } from "@/session/requests/session-request-tree"
import { showToast } from "@/shell/notifications/toast"
import { errorMessage } from "@/shell/layout/helpers"
import {
  SIDEBAR_COLLAPSE_THRESHOLD,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  assistantSidebar,
  isSessionPinned,
  persistSidebarCollapsed,
  persistSidebarWidth,
  toggleSessionPinned,
  toggleSidebarSection,
} from "@/assistant/sidebar-state"
import { pathKey } from "@/workspaces/path-key"

const SESSION_LIMIT = 60

const ROW = `
  flex h-8 min-w-0 w-full shrink-0 items-center gap-2 rounded-[6px] px-2 text-start
  text-[13px] text-v2-text-text-base [font-weight:440] outline-none
  transition-[background-color,color] duration-[120ms] ease-in-out
  hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover
`

const GROUP_LABEL = "px-2.5 pb-1 pt-3 text-[11px] text-v2-text-text-faint [font-weight:520]"

const EMPTY = "px-2.5 py-1.5 text-[12px] text-v2-text-text-faint"

const CHAT_ACTION =
  "pointer-events-none absolute inset-y-0 end-0 flex items-center pe-0.5 opacity-0 transition-opacity duration-[120ms] group-hover/chat:pointer-events-auto group-hover/chat:opacity-100 group-focus-within/chat:pointer-events-auto group-focus-within/chat:opacity-100 data-[visible=true]:pointer-events-auto data-[visible=true]:opacity-100"

type ChatGroup = { id: string; title: string; sessions: SessionInfo[] }

export function AssistantSidebar(props: { directory: string }) {
  const platform = usePlatform()
  const servers = useServers()
  const tabs = useTabs()
  const language = useLanguage()
  const settings = useSettingsSurface()
  const dialog = useDialog()
  const route = useCurrentRoute()

  const directory = props.directory

  const sidecar = () => servers.visible.find(ServerConnection.builtin)
  const ctx = useServerCtx(sidecar)
  const ready = () => {
    const local = ctx()

    return local && local.sdk.connection.status() === "connected" ? local : undefined
  }

  const [search, setSearch] = createSignal("")
  const runSearch = debounce(setSearch, 150)

  const [sessions, { refetch: refetchSessions }] = createResource(
    () => (ready() ? { ready: ready()!, search: search() } : undefined),
    (input) =>
      input.ready.sdk.api.session
        .list({
          limit: SESSION_LIMIT,
          order: "desc",
          parentID: null,
          ...(input.search ? { search: input.search } : {}),
        })
        .then((response) => response.data)
        .catch(() => [] as SessionInfo[]),
  )

  const chats = createMemo(() => {
    // Merge the fetched page with the event store, newest first; the store wins on conflict
    // exactly like the Home index does. Every conversation is listed, whatever folder it runs in,
    // because earlier chats were created before the assistant had its own folder. The query also
    // filters by title on the server when a search term is active.
    const query = search().trim().toLowerCase()
    const byID = new Map<string, SessionInfo>()
    for (const session of sessions.latest ?? []) byID.set(session.id, session)
    for (const session of ready()?.data.session.list() ?? []) {
      if (session.parentID || typeof session.time.archived === "number") continue
      if (query && !sessionLabel(session).toLowerCase().includes(query)) continue
      byID.set(session.id, session)
    }

    return [...byID.values()]
      .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, SESSION_LIMIT)
  })

  const groups = createMemo<ChatGroup[]>(() => {
    const now = new Date()
    const today = localDay(now)
    const yesterday = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
    const week = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7))
    const pinned: SessionInfo[] = []
    const todayChats: SessionInfo[] = []
    const yesterdayChats: SessionInfo[] = []
    const weekChats: SessionInfo[] = []
    const olderChats: SessionInfo[] = []

    for (const session of chats()) {
      if (isSessionPinned(session.id)) {
        pinned.push(session)
        continue
      }

      const day = localDay(new Date(session.time.updated ?? session.time.created))

      if (day === today) todayChats.push(session)
      else if (day === yesterday) yesterdayChats.push(session)
      else if (day >= week) weekChats.push(session)
      else olderChats.push(session)
    }

    return [
      { id: "pinned", title: language.t("assistant.pinned"), sessions: pinned },
      { id: "today", title: language.t("assistant.group.today"), sessions: todayChats },
      { id: "yesterday", title: language.t("assistant.group.yesterday"), sessions: yesterdayChats },
      { id: "week", title: language.t("assistant.group.week"), sessions: weekChats },
      { id: "older", title: language.t("assistant.group.older"), sessions: olderChats },
    ].filter((group) => group.sessions.length > 0)
  })

  const activeSessionID = () => {
    const current = route()

    return current.type === "session" ? current.sessionId : undefined
  }

  const projects = createMemo(() =>
    (ready()?.projects.list() ?? []).filter((project) => pathKey(project.worktree) !== pathKey(directory)),
  )

  const artifacts = useQuery(() => {
    const local = ready()

    return {
      queryKey: ["assistant-artifacts", directory],
      enabled: !!local,
      queryFn: local
        ? ({ signal }: { signal?: AbortSignal }) =>
            local.sdk.api.file
              .list({ location: { directory }, path: "." }, { signal })
              .then((response) => response.data)
        : skipToken,
      staleTime: 20_000,
    }
  })

  const artifactEntries = createMemo(() =>
    (artifacts.data ?? []).filter((entry) => !entry.path.split(/[\\/]/)[0].startsWith(".")),
  )

  const openArtifact = (entry: { path: string; type: string }) => {
    const relative = entry.path.replace(/[/\\]+$/, "")
    const absolute = `${directory}/${relative}`

    if (entry.type === "directory") void platform.revealPath?.(absolute)
    else void platform.openPath?.(absolute)
  }

  const newChat = () => {
    const conn = sidecar()
    const local = ready()

    if (!conn || !local) return
    local.projects.open(directory)
    local.projects.touch(directory)
    void tabs.newDraft({ server: ServerConnection.key(conn), directory }, "")
  }

  const openChat = (session: SessionInfo) => {
    const conn = sidecar()
    const local = ready()

    if (!conn || !local) return
    void local.data.session.message.sync(session.id).catch(() => undefined)
    void startTransition(() => {
      const tab = tabs.addSessionTab({ server: ServerConnection.key(conn), sessionId: session.id })
      tabs.select(tab)
      local.data.session.remember(session)
      local.projects.open(session.location.directory)
      local.projects.touch(session.location.directory)
    })
  }

  const renameChat = async (session: SessionInfo, title: string) => {
    const local = ready()

    if (!local) return false
    const next = title.trim()

    if (!next || next === sessionLabel(session)) return true

    try {
      await local.sdk.api.session.update({ sessionID: session.id, title: next })
      local.data.session.remember({ ...(local.data.session.get(session.id) ?? session), title: next })
      local.data.session.invalidate(session.id)
      void local.data.session.sync(session.id).catch(() => undefined)

      return true
    } catch (cause) {
      showToast({
        title: language.t("common.requestFailed"),
        description: errorMessage(cause, language.t("common.requestFailed")),
      })

      return false
    }
  }

  const removeChat = async (session: SessionInfo) => {
    const conn = sidecar()
    const local = ready()

    if (!conn || !local) return false
    const ids = sessionTreeIDs(local.data.session.list(), session.id)

    try {
      await local.data.session.remove(session.id)
      // The fetched page is independent of the event store, so it still lists the removed session
      // until it is read again.
      void refetchSessions()
      notifySessionTabsRemoved({
        server: ServerConnection.key(conn),
        directory: session.location.directory,
        sessionIDs: ids,
      })
      if (isSessionPinned(session.id)) toggleSessionPinned(session.id)

      return true
    } catch (cause) {
      showToast({
        title: language.t("session.delete.failed.title"),
        description: errorMessage(cause, language.t("session.delete.failed.title")),
      })

      return false
    }
  }

  const confirmDelete = (session: SessionInfo) => {
    void dialog.show(() => <DeleteChatDialog session={session} onConfirm={() => removeChat(session)} />)
  }

  const openProject = (project: LocalProject) => {
    const conn = sidecar()
    const local = ready()

    if (!conn || !local) return
    local.projects.open(project.worktree)
    local.projects.touch(project.worktree)
    void tabs.newDraft({ server: ServerConnection.key(conn), directory: project.worktree }, "")
  }

  const projectName = (project: LocalProject) =>
    project.name ?? project.worktree.split(/[\\/]/).filter(Boolean).pop() ?? project.worktree

  return (
    <aside
      data-slot="assistant-sidebar"
      class="relative flex h-full min-h-0 shrink-0 flex-col bg-v2-background-bg-deep px-2.5 pb-[max(10px,var(--shell-bottom-inset,8px))] pt-2"
      style={{ width: `${assistantSidebar.width}px` }}
    >
      <ResizeHandle
        class="-end-2 z-20"
        direction="horizontal"
        size={assistantSidebar.width}
        min={SIDEBAR_MIN_WIDTH}
        max={SIDEBAR_MAX_WIDTH}
        collapseThreshold={SIDEBAR_COLLAPSE_THRESHOLD}
        onResize={persistSidebarWidth}
        onCollapse={() => persistSidebarCollapsed(true)}
      />
      <div data-slot="assistant-brand" class="flex h-9 items-center gap-2.5 px-1.5">
        <img
          src="/assets/logo-cairn.svg"
          alt=""
          aria-hidden="true"
          class="size-6 shrink-0 rounded-[7px] shadow-[0_0_0_1px_var(--v2-border-border-weaker)]"
        />
        <span
          class="truncate text-[15px] text-v2-text-text-base"
          style={{ "font-family": "var(--cairn-font-serif)", "font-weight": "600", "letter-spacing": "-0.01em" }}
        >
          Cairn
        </span>
      </div>
      <Button
        class="mb-2 mt-1 h-8 w-full justify-start"
        variant="contrast"
        icon="plus-small"
        onClick={newChat}
      >
        {language.t("assistant.new")}
      </Button>
      <TextInput
        class="mb-1 w-full"
        value={search()}
        autocomplete="off"
        spellcheck={false}
        placeholder={language.t("assistant.search")}
        leadingIcon={<Icon name="magnifying-glass" class="text-v2-icon-icon-muted" />}
        onInput={(event) => runSearch(event.currentTarget.value)}
      />
      <ScrollView class="min-h-0 flex-1 overflow-y-auto pt-1">
        <Show
          when={groups().length > 0}
          fallback={
            <div class="flex flex-col gap-1 px-2.5 py-3">
              <span class="text-[12px] text-v2-text-text-faint">
                {search().trim() ? language.t("assistant.search.empty") : language.t("assistant.chats.empty")}
              </span>
              <Show when={!search().trim()}>
                <span class="text-[12px] text-v2-text-text-faint">{language.t("assistant.chats.emptyHint")}</span>
              </Show>
            </div>
          }
        >
          <For each={groups()}>
            {(group) => (
              <section data-slot="assistant-chat-group" data-group={group.id} class="mb-1">
                <div class={GROUP_LABEL}>{group.title}</div>
                <For each={group.sessions}>
                  {(session) => (
                    <ChatRow
                      session={session}
                      server={() => {
                        const conn = sidecar()

                        return conn ? ServerConnection.key(conn) : undefined
                      }}
                      active={activeSessionID() === session.id}
                      pinned={isSessionPinned(session.id)}
                      onOpen={() => openChat(session)}
                      onRename={(title) => renameChat(session, title)}
                      onTogglePin={() => toggleSessionPinned(session.id)}
                      onDelete={() => confirmDelete(session)}
                    />
                  )}
                </For>
              </section>
            )}
          </For>
        </Show>
        <Show when={projects().length > 0}>
          <CollapsibleSection
            label={language.t("home.projects")}
            icon="folder"
            open={assistantSidebar.sections.projects}
            onToggle={() => toggleSidebarSection("projects")}
          >
            <For each={projects()}>
              {(project) => (
                <button type="button" class={ROW} onClick={() => openProject(project)}>
                  <Icon name="folder" class="shrink-0 text-v2-icon-icon-muted" />
                  <span class="truncate">{projectName(project)}</span>
                </button>
              )}
            </For>
          </CollapsibleSection>
        </Show>
        <CollapsibleSection
          label={language.t("assistant.artifacts")}
          icon="file-tree"
          open={assistantSidebar.sections.artifacts}
          onToggle={() => toggleSidebarSection("artifacts")}
        >
          <Show
            when={artifactEntries().length > 0}
            fallback={<div class={EMPTY}>{language.t("assistant.artifacts.empty")}</div>}
          >
            <For each={artifactEntries()}>
              {(entry) => (
                <button type="button" class={ROW} onClick={() => openArtifact(entry)}>
                  <Icon
                    name={entry.type === "directory" ? "folder" : "file-tree"}
                    class="shrink-0 text-v2-icon-icon-muted"
                  />
                  <span class="truncate">{entry.path.replace(/[/\\]+$/, "")}</span>
                </button>
              )}
            </For>
          </Show>
        </CollapsibleSection>
      </ScrollView>
      <div class="mt-2 flex flex-col gap-0.5 border-t border-v2-border-border-weaker pt-2">
        <GoCard />
        <button type="button" class={ROW} onClick={() => settings.open("extensions")}>
          <Icon name="outline-globe-plus" class="shrink-0 text-v2-icon-icon-muted" />
          <span class="truncate">{language.t("assistant.connectors")}</span>
        </button>
        <button type="button" class={ROW} onClick={() => settings.open()}>
          <Icon name="settings-gear" class="shrink-0 text-v2-icon-icon-muted" />
          <span class="truncate">{language.t("assistant.settings")}</span>
        </button>
      </div>
    </aside>
  )
}

function ChatRow(props: {
  session: SessionInfo
  server: () => ServerConnection.Key | undefined
  active: boolean
  pinned: boolean
  onOpen: () => void
  onRename: (title: string) => Promise<boolean>
  onTogglePin: () => void
  onDelete: () => void
}) {
  const language = useLanguage()
  const [editing, setEditing] = createSignal(false)
  const [draft, setDraft] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)
  let input: HTMLInputElement | undefined
  let row: HTMLButtonElement | undefined
  let cancelled = false

  const status = useSessionTabAvatarState(
    () => props.server() ?? ServerConnection.Key.make(""),
    () => props.session.id,
  )

  const loading = () => status.loading()
  const unread = () => status.unread() && !loading()
  const title = () => sessionLabel(props.session)

  const startRename = () => {
    cancelled = false
    setDraft(title())
    setEditing(true)
    requestAnimationFrame(() => {
      input?.focus()
      input?.select()
    })
  }

  const save = async () => {
    if (saving() || cancelled) return
    setSaving(true)
    const saved = await props.onRename(draft())
    setSaving(false)

    if (!saved) {
      requestAnimationFrame(() => {
        input?.focus()
        input?.select()
      })

      return
    }

    setEditing(false)
    requestAnimationFrame(() => row?.focus())
  }

  const cancel = () => {
    if (saving()) return
    cancelled = true
    setEditing(false)
    requestAnimationFrame(() => row?.focus())
  }

  return (
    <div
      data-slot="assistant-chat-row"
      data-session-id={props.session.id}
      class="group/chat relative flex min-w-0 items-center"
    >
      <Show
        when={!editing()}
        fallback={
          <div class="flex h-8 min-w-0 w-full items-center gap-2 rounded-[6px] bg-v2-overlay-simple-overlay-hover px-2">
            <span class="flex size-3.5 shrink-0 items-center justify-center">
              <Show when={loading()}>
                <span class="size-3 animate-spin rounded-full border border-v2-border-border-muted border-t-v2-icon-icon-base" />
              </Show>
              <Show when={unread()}>
                <span class="size-[5px] rounded-full bg-v2-icon-icon-accent" />
              </Show>
            </span>
            <InlineInput
              ref={(element) => (input = element)}
              class="min-w-0 flex-1 bg-transparent text-[13px] text-v2-text-text-base outline-none"
              value={draft()}
              disabled={saving()}
              onInput={(event) => setDraft(event.currentTarget.value)}
              onBlur={() => void save()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void save()
                }

                if (event.key === "Escape") {
                  event.preventDefault()
                  cancel()
                }
              }}
            />
          </div>
        }
      >
        <button
          ref={row}
          type="button"
          class={ROW}
          classList={{
            "bg-v2-overlay-simple-overlay-hover": props.active,
            "pe-7": true,
          }}
          aria-current={props.active ? "page" : undefined}
          onClick={props.onOpen}
        >
          <span class="flex size-3.5 shrink-0 items-center justify-center">
            <Show when={loading()}>
              <span
                data-slot="assistant-chat-loading"
                class="size-3 animate-spin rounded-full border border-v2-border-border-muted border-t-v2-icon-icon-base"
              />
            </Show>
            <Show when={unread()}>
              <span data-slot="assistant-chat-unread" class="size-[5px] rounded-full bg-v2-icon-icon-accent" />
            </Show>
          </span>
          <span class="truncate">{title()}</span>
        </button>
        <div class={CHAT_ACTION} data-visible={menuOpen()}>
          <Menu
            gutter={6}
            modal={false}
            placement="bottom-end"
            open={menuOpen()}
            onOpenChange={setMenuOpen}
          >
            <Menu.Trigger
              as={IconButton}
              variant="ghost-muted"
              size="small"
              icon={<Icon name="outline-dots" />}
              aria-label={language.t("common.moreOptions")}
            />
            <Menu.Portal>
              <Menu.Content>
                <Menu.Item onSelect={startRename}>{language.t("common.rename")}</Menu.Item>
                <Menu.Item onSelect={props.onTogglePin}>
                  {props.pinned ? language.t("assistant.unpin") : language.t("assistant.pin")}
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item onSelect={props.onDelete}>{language.t("common.delete")}…</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu>
        </div>
      </Show>
    </div>
  )
}

function DeleteChatDialog(props: { session: SessionInfo; onConfirm: () => Promise<boolean> }) {
  const language = useLanguage()
  const dialog = useDialog()
  const name = () => sessionLabel(props.session)

  const confirm = async () => {
    await props.onConfirm()
    dialog.close()
  }

  return (
    <Dialog fit>
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("assistant.delete.title")}
          description={language.t("assistant.delete.confirm", { name: name() })}
        />
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button variant="danger" onClick={confirm}>
          {language.t("assistant.delete.button")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function CollapsibleSection(props: {
  label: string
  icon?: IconName
  open: boolean
  onToggle: () => void
  children: JSX.Element
}) {
  return (
    <div class="mt-2">
      <button
        type="button"
        class="flex h-7 min-w-0 w-full shrink-0 items-center gap-2 rounded-[6px] px-2.5 text-start text-[11px] text-v2-text-text-faint [font-weight:520] outline-none transition-[background-color] duration-[120ms] ease-in-out hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover"
        onClick={props.onToggle}
        aria-expanded={props.open}
      >
        <Show when={props.icon} keyed>
          {(icon) => <Icon name={icon} class="shrink-0 text-v2-icon-icon-muted" />}
        </Show>
        <span class="min-w-0 flex-1 truncate">{props.label}</span>
        <Icon
          name={props.open ? "chevron-down" : "chevron-right"}
          size="small"
          class="shrink-0 text-v2-text-text-faint"
        />
      </button>
      <Show when={props.open}>
        <div class="mb-1">{props.children}</div>
      </Show>
    </div>
  )
}

function localDay(date: Date) {
  return date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate()
}

const GO_REFRESH = 300_000

function GoCard() {
  const platform = usePlatform()
  const language = useLanguage()

  const usage = useQuery(() => ({
    queryKey: ["assistant-go-usage"],
    enabled: !!platform.goUsage,
    queryFn: async () => ((await platform.goUsage?.()) ?? null) as GoUsage | null,
    staleTime: 240_000,
    refetchInterval: GO_REFRESH,
  }))

  const rows = createMemo(() => {
    const data = usage.data
    if (!data) return []
    const list: Array<{ label: string; window: GoUsageWindow }> = []
    if (data.rolling) list.push({ label: language.t("assistant.go.rolling"), window: data.rolling })
    if (data.weekly) list.push({ label: language.t("assistant.go.week"), window: data.weekly })
    if (data.monthly) list.push({ label: language.t("assistant.go.month"), window: data.monthly })
    return list
  })

  return (
    <Show when={rows().length > 0}>
      <div
        data-slot="assistant-go"
        class="mb-1 flex flex-col gap-1.5 rounded-[8px] border border-v2-border-border-muted px-2.5 py-2"
      >
        <span class="text-[12px] text-v2-text-text-base [font-weight:440]">OpenCode Go</span>
        <For each={rows()}>
          {(row) => (
            <div class="flex items-center gap-2">
              <span class="w-11 shrink-0 truncate text-[12px] text-v2-text-text-muted">{row.label}</span>
              <div class="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-v2-border-border-muted">
                <div
                  class="h-full rounded-full bg-v2-icon-icon-base"
                  style={{ width: `${Math.min(100, Math.max(0, row.window.percent))}%` }}
                />
              </div>
              <span class="shrink-0 text-[12px] text-v2-text-text-muted tabular-nums">
                {Math.round(row.window.percent)}%
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
