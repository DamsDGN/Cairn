import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { ScrollView } from "@opencode/ui/scroll-view"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useModels } from "@/providers/models/models"
import { showToast } from "@/shell/notifications/toast"
import { SettingsRow } from "@/settings/row"
import "./default-model.css"

type ModelItem = ReturnType<ReturnType<typeof useModels>["list"]>[number]

// The default model lives in the Conversations folder configuration, not in the session selection,
// so a new conversation starts on it before anything is picked.
export function DefaultModelSetting() {
  const language = useLanguage()
  const platform = usePlatform()
  const models = useModels()
  const dialog = useDialog()

  const [current, { refetch }] = createResource(
    () => platform.assistantConfig?.defaultModel() ?? Promise.resolve(undefined),
  )

  const label = createMemo(() => {
    const value = current.latest

    if (!value) return language.t("settings.models.default.none")

    const item = models.list().find((model) => `${model.provider.id}/${model.id}` === value)

    return item?.name ?? value
  })

  return (
    <Show when={platform.assistantConfig}>
      <SettingsRow title={language.t("settings.models.default.title")} description={language.t("settings.models.default.description")}>
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
  const models = useModels()
  const dialog = useDialog()
  const [query, setQuery] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const items = createMemo(() => {
    const needle = query().trim().toLowerCase()
    const list = models.list()

    if (!needle) return list

    return list.filter((model) =>
      `${model.provider.name} ${model.name} ${model.id}`.toLowerCase().includes(needle),
    )
  })

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

  const key = (model: ModelItem) => `${model.provider.id}/${model.id}`

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
