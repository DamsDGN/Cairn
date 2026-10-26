import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform, type VoiceLocalModelID } from "@/runtime/platform/platform"
import type { ComposerModel } from "@/composer/model"
import { showToast } from "@/shell/notifications/toast"
import { dictationLanguage } from "./languages"
import { DialogVoiceModels } from "./model-dialog"
import { useVoiceModels } from "./models"
import { floatToPcm16, sliceSamples } from "./pcm"
import { RECORDING_LIMIT_MS, startRecorder, type Recorder, type RecorderFrame } from "./recorder"
import { createSpeechSegmenter, type SpeechSegment } from "./segmenter"

type Phase = "idle" | "recording" | "transcribing"

function clock(ms: number) {
  const seconds = Math.floor(ms / 1000)

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/** Local dictation: record, transcribe sentence by sentence on this machine, insert the text. */
export function AssistantDictationButton(props: { composer: ComposerModel }) {
  const platform = usePlatform()
  const dialog = useDialog()
  const language = useLanguage()
  const voice = useVoiceModels()

  const [phase, setPhase] = createSignal<Phase>("idle")
  const [elapsed, setElapsed] = createSignal(0)
  const [waiting, setWaiting] = createSignal(0)

  let recorder: Recorder | undefined
  let selected: VoiceLocalModelID | undefined
  let spoken = "en"
  let vocabulary: string | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let frames: Float32Array[] = []
  let segmenter = createSpeechSegmenter()
  // Every result carries the generation it was recorded in: cancelling bumps it, and a transcription
  // that was already running then drops its text instead of landing in a new dictation.
  let generation = 0
  let queue: Promise<void> = Promise.resolve()

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

  const transcribe = (segment: SpeechSegment, run: number) => {
    setWaiting((count) => count + 1)

    // One task at a time on the shared recognizer, and results land in the order the sentences were
    // spoken even when a later one finishes first.
    queue = queue.then(async () => {
      if (run !== generation) return

      try {
        const audio = floatToPcm16([sliceSamples(frames, segment.start, segment.end)])

        const text = await platform.voiceLocal!.transcribe({
          audio,
          id: selected,
          language: spoken,
          prompt: vocabulary,
        })

        if (run === generation && text) insert(text)
      } catch {
        if (run === generation)
          showToast({ variant: "error", title: language.t("assistant.dictation.error.transcribe") })
      } finally {
        setWaiting((count) => Math.max(0, count - 1))
      }
    })
  }

  const onFrame = (frame: RecorderFrame) => {
    frames.push(frame.samples)

    for (const segment of segmenter.push(frame.level, frame.samples.length)) transcribe(segment, generation)
  }

  const finish = async () => {
    const current = recorder

    if (!current) return
    recorder = undefined
    stopTimer()

    const last = segmenter.flush()

    if (last) transcribe(last, generation)

    await current.stop().catch(() => undefined)
    setPhase("transcribing")

    await queue

    setPhase("idle")
    setElapsed(0)
  }

  const cancel = async () => {
    const current = recorder

    generation += 1
    recorder = undefined
    selected = undefined
    stopTimer()
    setPhase("idle")
    setElapsed(0)
    setWaiting(0)
    frames = []
    segmenter = createSpeechSegmenter()
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

    // Without an explicit language the recognizer falls back to English and translates instead of
    // transcribing, so the setting always has a value: the user's choice, or their interface
    // language.
    const preferences = await platform.voiceLocal!.preferences()

    spoken = preferences.language ?? dictationLanguage(language.locale())
    vocabulary = preferences.prompt

    try {
      selected = voice.best()
      frames = []
      segmenter = createSpeechSegmenter()
      generation += 1
      recorder = await startRecorder({ onFrame })
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
          : phase() === "transcribing" || waiting() > 0
            ? language.t("assistant.dictation.transcribing")
            : language.t("assistant.dictation.action")}
      </span>
    </Button>
  )
}
