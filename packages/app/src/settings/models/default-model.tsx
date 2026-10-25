import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { ScrollView } from "@opencode/ui/scroll-view"
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useData } from "@/runtime/server/current"
import { normalizeProviderList } from "@/runtime/server/global-sync/utils"
import { showToast } from "@/shell/notifications/toast"
import { SettingsRow } from "@/settings/row"
import "./default-model.css"

type ModelItem = {
  id: string
  name: string
  providerID: string
  provider: { id: string; name: string }
}

// The default model lives in the Conversations folder configuration, not in the session selection,
// so a new conversation starts on it before anything is picked. Its catalog comes from that folder
// too, which is where the providers connected from the app are declared.
export function DefaultModelSetting() {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()

  const [current, { refetch }] = createResource(
    () => platform.assistantConfig?.defaultModel() ?? Promise.resolve(undefined),
  )

  const label = createMemo(() => {
    const value = current.latest

    if (!value) return language.t("settings.models.default.none")

    return value
  })

  return (
    <Show when={platform.assistantConfig}>
      <SettingsRow
        title={language.t("settings.models.default.title")}
        description={language.t("settings.models.default.description")}
      >
        <Button
          variant="outline"
          size="small"
          onClick={() =>
            void dialog.show(() => <DefaultModelDialog current={current.latest} onPicked={() => void refetch()} />)
          }
        >
          {label()}
        </Button>
      </SettingsRow>
    </Show>
  )
}

function DefaultModelDialog(props: { current?: string; onPicked?: () => void }) {
  const language = useLanguage()
  const platform = usePlatform()
  const data = useData()
  const dialog = useDialog()
  const [query, setQuery] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const reference = () => {
    const value = platform.assistantDirectory

    return value ? { directory: value } : undefined
  }

  createEffect(() => {
    const ref = reference()

    if (!ref) return

    void data.location.provider.sync(ref).catch(() => undefined)
    void data.location.model.sync(ref).catch(() => undefined)
  })

  const items = createMemo<ModelItem[]>(() => {
    const ref = reference()
    const provider = data.location.provider.list(ref)
    const model = data.location.model.list(ref)

    if (!provider || !model) return []

    const catalog = normalizeProviderList(provider, model)
    const all = [...catalog.all.values()].flatMap((entry) =>
      Object.values(entry.models).map((item) => ({
        id: item.id,
        name: item.name,
        providerID: entry.id,
        provider: { id: entry.id, name: entry.name },
      })),
    )
    const needle = query().trim().toLowerCase()

    if (!needle) return all

    return all.filter((item) =>
      `${item.provider.name} ${item.name} ${item.id}`.toLowerCase().includes(needle),
    )
  })

  const key = (model: ModelItem) => `${model.providerID}/${model.id}`

  const pick = async (value: string) => {
    if (busy() || !platform.assistantConfig) return

    setBusy(true)
    const result = await platform.assistantConfig.setDefaultModel(value).catch(() => undefined)
    setBusy(false)

    if (!result?.ok) {
      showToast({ title: language.t("settings.models.default.error"), variant: "error" })

      return
    }

    await props.onPicked?.()
    dialog.close()
  }

  return (
    <Dialog class="settings-server-dialog">
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("settings.models.default.title")}
          description={language.t("settings.models.default.dialog")}
        />
      </DialogHeader>
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col gap-3 px-4 pt-2 pb-4">
        <input
          type="search"
          value={query()}
          placeholder={language.t("settings.models.default.search")}
          class="settings-default-model-search"
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
        <ScrollView class="max-h-[50vh]">
          <div class="flex flex-col">
            <For each={items()}>
              {(model) => (
                <button
                  type="button"
                  class="settings-default-model-row"
                  data-active={props.current === key(model) ? true : undefined}
                  disabled={busy()}
                  onClick={() => void pick(key(model))}
                >
                  <span class="min-w-0 truncate text-start">{model.name}</span>
                  <span class="shrink-0 text-11-regular text-v2-text-text-muted">{model.provider.name}</span>
                </button>
              )}
            </For>
          </div>
        </ScrollView>
      </DialogBody>
    </Dialog>
  )
}
