import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform, type VoiceLocalModelID } from "@/runtime/platform/platform"
import type { ComposerModel } from "@/composer/model"
import { showToast } from "@/shell/notifications/toast"
import { DialogVoiceModels } from "./model-dialog"
import { useVoiceModels } from "./models"
import { RECORDING_LIMIT_MS, startRecorder, type Recorder } from "./recorder"

type Phase = "idle" | "recording" | "transcribing"

function clock(ms: number) {
  const seconds = Math.floor(ms / 1000)

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Local dictation: record, transcribe on this machine, insert the text in the composer. */
export function AssistantDictationButton(props: { composer: ComposerModel }) {
  const platform = usePlatform()
  const dialog = useDialog()
  const language = useLanguage()
  const voice = useVoiceModels()

  const [phase, setPhase] = createSignal<Phase>("idle")
  const [elapsed, setElapsed] = createSignal(0)

  let recorder: Recorder | undefined
  let selected: VoiceLocalModelID | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const stopTimer = () => {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  const insert = (text: string) => {
    const current = props.composer.value()
    const separator = current.length > 0 && !/\s$/.test(current) ? " " : ""

    props.composer.onInput(`${current}${separator}${text}`)
    props.composer.restoreFocus()
  }

  const finish = async () => {
    const current = recorder

    if (!current) return
    recorder = undefined
    stopTimer()
    setPhase("transcribing")

    try {
      const audio = await current.stop()
      // Without an explicit language the recognizer falls back to English and translates instead of
      // transcribing. The interface language is the best available hint until dictation has its own
      // spoken-language setting.
      const text = await platform.voiceLocal!.transcribe({
        audio,
        id: selected,
        language: language.locale().split("-")[0],
      })

      if (text) insert(text)
    } catch {
      showToast({ variant: "error", title: language.t("assistant.dictation.error.transcribe") })
    } finally {
      setPhase("idle")
      setElapsed(0)
    }
  }

  const cancel = async () => {
    const current = recorder

    recorder = undefined
    selected = undefined
    stopTimer()
    setPhase("idle")
    setElapsed(0)
    await current?.cancel()
  }

  const start = async () => {
    if (phase() !== "idle") return

    if (!voice.best()) {
      dialog.show(() => (
        <DialogVoiceModels
          onInstalled={() => {
            dialog.close()
            void start()
          }}
        />
      ))

      return
    }

    try {
      selected = voice.best()
      recorder = await startRecorder()
    } catch {
      showToast({ variant: "error", title: language.t("assistant.dictation.error.microphone") })

      return
    }

    setPhase("recording")
    setElapsed(0)
    timer = setInterval(() => {
      const next = elapsed() + 1000

      setElapsed(next)

      if (next >= RECORDING_LIMIT_MS) void finish()
    }, 1000)
  }

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase() === "recording") {
        event.preventDefault()
        void cancel()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    onCleanup(() => document.removeEventListener("keydown", onKeyDown))
  })

  onCleanup(() => {
    stopTimer()
    void recorder?.cancel()
  })

  return (
    <Button
      data-action="assistant-dictation"
      data-phase={phase()}
      variant="ghost-faint"
      size="small"
      disabled={phase() === "transcribing"}
      onClick={() => {
        if (phase() === "recording") {
          void finish()

          return
        }

        void start()
      }}
    >
      <Show
        when={phase() === "recording"}
        fallback={<Icon name="microphone" class="shrink-0 text-v2-icon-icon-muted" />}
      >
        <span class="size-2 animate-pulse rounded-full bg-v2-state-fg-danger" />
      </Show>
      <span class="hidden sm:block">
        {phase() === "recording"
          ? language.t("assistant.dictation.recording", { time: clock(elapsed()) })
          : phase() === "transcribing"
            ? language.t("assistant.dictation.transcribing")
            : language.t("assistant.dictation.action")}
      </span>
    </Button>
  )
}
