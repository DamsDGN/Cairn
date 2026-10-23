import type { SessionInfo } from "@opencode/client/promise"
import type { GoUsage, GoUsageWindow } from "@/runtime/platform/platform"
import { skipToken, useQuery } from "@tanstack/solid-query"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { ScrollView } from "@opencode/ui/scroll-view"
import { For, Show, createMemo, createResource, startTransition, type JSX } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useServerCtx } from "@/runtime/server/runtime"
import { sessionLabel } from "@/session/title"
import { useSettingsSurface } from "@/settings/surface"
import { useTabs } from "@/shell/tabs/tabs"
import type { LocalProject } from "@/shell/state/layout"
import { pathKey } from "@/workspaces/path-key"

const SESSION_LIMIT = 30

const SECTION_LABEL = "text-[12px] text-v2-text-text-muted [font-weight:440]"

const ROW = `
  flex h-9 min-w-0 w-full shrink-0 items-center gap-2 rounded-[6px] px-2.5 text-start
  text-v2-text-text-base [font-weight:440] outline-none
  transition-[background-color] duration-[120ms] ease-in-out
  hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover
`

const EMPTY = "ps-2.5 text-[12px] text-v2-text-text-faint"

export function AssistantSidebar(props: { directory: string }) {
  const platform = usePlatform()
  const servers = useServers()
  const tabs = useTabs()
  const language = useLanguage()
  const settings = useSettingsSurface()

  const directory = props.directory

  const sidecar = () => servers.visible.find(ServerConnection.builtin)
  const ctx = useServerCtx(sidecar)
  const ready = () => {
    const local = ctx()

    return local && local.sdk.connection.status() === "connected" ? local : undefined
  }

  const [sessions] = createResource(
    () => ready() || undefined,
    (local) =>
      local.sdk.api.session
        .list({ directory, limit: SESSION_LIMIT, order: "desc", parentID: null })
        .then((response) => response.data)
        .catch(() => [] as SessionInfo[]),
  )

  const chats = createMemo(() => {
    // Merge the fetched page with the event store, newest first; the store wins on conflict
    // exactly like the Home index does.
    const byID = new Map<string, SessionInfo>()
    for (const session of sessions.latest ?? []) byID.set(session.id, session)
    for (const session of ready()?.data.session.list() ?? []) {
      if (session.parentID || typeof session.time.archived === "number") continue
      if (pathKey(session.location.directory) !== pathKey(directory)) continue
      byID.set(session.id, session)
    }

    return [...byID.values()]
      .toSorted((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, SESSION_LIMIT)
  })

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
      local.projects.open(directory)
      local.projects.touch(directory)
    })
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
      class="relative flex h-full min-h-0 w-[264px] shrink-0 flex-col bg-v2-background-bg-deep px-2.5 pb-[max(10px,var(--shell-bottom-inset,8px))] pt-2"
    >
      <Button class="mb-2 w-full justify-start" variant="submit" icon="plus-small" onClick={newChat}>
        {language.t("assistant.new")}
      </Button>
      <ScrollView class="min-h-0 flex-1 overflow-y-auto">
        <Section label={language.t("assistant.chats")}>
          <Show when={chats().length > 0} fallback={<div class={EMPTY}>{language.t("assistant.chats.empty")}</div>}>
            <For each={chats()}>
              {(session) => (
                <button type="button" class={ROW} onClick={() => openChat(session)}>
                  <span class="truncate">{sessionLabel(session)}</span>
                </button>
              )}
            </For>
          </Show>
        </Section>
        <Show when={projects().length > 0}>
          <Section label={language.t("home.projects")}>
            <For each={projects()}>
              {(project) => (
                <button type="button" class={ROW} onClick={() => openProject(project)}>
                  <Icon name="folder" class="shrink-0 text-v2-icon-icon-muted" />
                  <span class="truncate">{projectName(project)}</span>
                </button>
              )}
            </For>
          </Section>
        </Show>
        <Section label={language.t("assistant.artifacts")}>
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
        </Section>
      </ScrollView>
      <div class="mt-2 flex flex-col gap-0.5">
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

function Section(props: { label: string; children: JSX.Element }) {
  return (
    <div class="mb-3">
      <div class={`${SECTION_LABEL} px-2.5 pb-1 pt-1.5`}>{props.label}</div>
      {props.children}
    </div>
  )
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
