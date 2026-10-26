import { Show } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Icon } from "@opencode/ui/icon"
import { Spinner } from "@opencode/ui/spinner"
import { useLanguage } from "@/runtime/i18n/language"
import type { VoiceLocalModel, VoiceLocalModelID } from "@/runtime/platform/platform"
import type { VoiceModels } from "./models"

const LABEL: Record<
  VoiceLocalModelID,
  | "settings.voice.model.base-q5_1"
  | "settings.voice.model.small-q5_1"
  | "settings.voice.model.small"
  | "settings.voice.model.silero-v6.2.0"
  | "settings.voice.model.vits-piper-fr_FR-siwis-medium"
> = {
  "base-q5_1": "settings.voice.model.base-q5_1",
  "small-q5_1": "settings.voice.model.small-q5_1",
  small: "settings.voice.model.small",
  "silero-v6.2.0": "settings.voice.model.silero-v6.2.0",
  "vits-piper-fr_FR-siwis-medium": "settings.voice.model.vits-piper-fr_FR-siwis-medium",
}

const RECOMMENDED: VoiceLocalModelID = "base-q5_1"

export function formatSize(bytes: number) {
  return `${Math.round(bytes / 1_000_000)} MB`
}

/** One voice model in the settings and the dictation dialog: state, progress, download, delete. */
export function VoiceModelRow(props: {
  model: VoiceLocalModel
  voice: VoiceModels
  onInstalled?: () => void
}) {
  const language = useLanguage()
  const state = () => props.voice.state(props.model.id)
  const busy = () => state().status === "downloading"
  const percent = () => Math.round(props.voice.progress(props.model.id) * 100)

  const install = async () => {
    try {
      await props.voice.download(props.model.id)
      props.onInstalled?.()
    } catch {
      // The row shows the failure through the model state; no toast, the user is already looking at it.
    }
  }

  return (
    <div
      class="flex items-center gap-3 border-b border-v2-border-border-base py-4 last:border-b-0"
      data-component="voice-model"
      data-model={props.model.id}
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <span class="truncate text-[13px] text-v2-text-text-base">{language.t(LABEL[props.model.id])}</span>
          <Show when={props.model.id === RECOMMENDED}>
            <span class="rounded-full bg-v2-background-bg-layer-2 px-2 py-0.5 text-[10px] text-v2-text-text-faint">
              {language.t("settings.voice.model.recommended")}
            </span>
          </Show>
        </div>
        <span class="text-[11px] text-v2-text-text-faint">
          {busy()
            ? language.t("settings.voice.model.downloading", { percent: percent() })
            : state().status === "failed"
              ? language.t("settings.voice.model.failed")
              : language.t("settings.voice.model.size", { size: formatSize(props.model.size) })}
        </span>
        <Show when={busy()}>
          <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-v2-background-bg-layer-2">
            <div class="h-full bg-v2-icon-icon-accent transition-[width]" style={{ width: `${percent()}%` }} />
          </div>
        </Show>
      </div>
      <Show
        when={!busy()}
        fallback={<Spinner class="size-4 shrink-0" />}
      >
        <Show
          when={props.model.installed}
          fallback={
            <Button variant="outline" size="small" onClick={() => void install()}>
              {language.t("settings.voice.model.download")}
            </Button>
          }
        >
          <div class="flex shrink-0 items-center gap-2">
            <span class="flex items-center gap-1 text-[11px] text-v2-text-text-faint">
              <Icon name="check" class="size-3" />
              {language.t("settings.voice.model.installed")}
            </span>
            <Button variant="ghost-muted" size="small" onClick={() => void props.voice.remove(props.model.id)}>
              {language.t("settings.voice.model.delete")}
            </Button>
          </div>
        </Show>
      </Show>
    </div>
  )
}
