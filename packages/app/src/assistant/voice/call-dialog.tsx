import { Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import type { ComposerModel } from "@/composer/model"
import type { SessionModel } from "@/session/model"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform, type VoiceLocalModelID } from "@/runtime/platform/platform"
import { useData } from "@/runtime/server/current"
import { useSettingsSurface } from "@/settings/surface"
import { showToast } from "@/shell/notifications/toast"
import { dictationLanguage } from "./languages"
import { useVoiceModels } from "./models"
import { floatToPcm16, sliceSamples } from "./pcm"
import { startRecorder, type Recorder, type RecorderFrame } from "./recorder"
import { createSpeechSegmenter, type SpeechSegment } from "./segmenter"
import { splitSentences, speakable } from "./speech"
import { createSpeaker, type Speaker } from "./tts"

type CallState = "starting" | "listening" | "thinking" | "speaking" | "error"

const STATE_DOT = {
  starting: "bg-v2-icon-icon-muted",
  listening: "animate-pulse bg-v2-icon-icon-accent",
  thinking: "bg-v2-icon-icon-muted",
  speaking: "bg-v2-icon-icon-base",
  error: "bg-v2-icon-icon-muted",
} as const

const STATE_LABEL = {
  starting: "assistant.voice.connecting",
  listening: "assistant.voice.listening",
  thinking: "assistant.voice.responding",
  speaking: "assistant.voice.speaking",
  error: "assistant.voice.error",
} as const

// Half duplex: Cairn listens, answers out loud, then listens again. Speaking over the answer stops
// the playback and starts the next turn.
export function VoiceCallDialog(props: { session: SessionModel; composer: ComposerModel; onClose: () => void }) {
  const platform = usePlatform()
  const language = useLanguage()
  const data = useData()
  const settings = useSettingsSurface()
  const voice = useVoiceModels()

  const [state, setState] = createSignal<CallState>("starting")
  const [heard, setHeard] = createSignal("")
  const [reply, setReply] = createSignal("")
  const [failure, setFailure] = createSignal<string>()

  let recorder: Recorder | undefined
  let speaker: Speaker | undefined
  let segmenter = createSpeechSegmenter()
  let frames: Float32Array[] = []
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  let model: VoiceLocalModelID | undefined
  let spoken = "en"
  let vocabulary: string | undefined
  let closed = false
  let interrupted = false

  // One turn: the messages that existed when the prompt was sent, and the characters of the answer
  // already turned into sentences.
  let turnFrom = -1
  let unseen = 0
  let pending = ""
  let working = false
  let finished = false

  const queue: string[] = []
  let pumping = false

  // A sentence spoken over the answer is kept until the model run it interrupted finishes, then
  // submitted as the next turn.
  let deferred: SpeechSegment | undefined

  let loud = 0

  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = undefined
  }

  const close = () => {
    if (closed) return
    closed = true
    clearIdle()
    void recorder?.cancel()
    recorder = undefined
    speaker?.stop()
    speaker?.dispose()
    speaker = undefined
    props.onClose()
  }

  const fail = (message: string) => {
    setFailure(message)
    setState("error")
  }

  const settle = () => {
    if (closed || interrupted) return

    if (working || pumping || queue.length || pending.trim()) return

    setState("listening")
  }

  const finishTurn = () => {
    if (finished || closed || interrupted) return
    finished = true

    const last = speakable(pending)

    pending = ""

    if (last) queue.push(last)

    void pump()
  }

  const pump = async (): Promise<void> => {
    if (pumping || closed || interrupted) return
    pumping = true

    while (queue.length && !closed && !interrupted) {
      const sentence = queue.shift()!

      setState("speaking")

      try {
        await speaker!.speak(sentence)
      } catch (error) {
        if (!closed && !interrupted) fail(error instanceof Error ? error.message : String(error))
      }
    }

    pumping = false

    if (queue.length && !closed && !interrupted) return pump()

    settle()
  }

  const enqueue = (sentences: string[]) => {
    if (closed || interrupted) return

    const text = sentences.flatMap((sentence) => {
      const spoken = speakable(sentence)

      return spoken ? [spoken] : []
    })

    if (!text.length) return

    queue.push(...text)
    void pump()
  }

  // The status can flip before the effect sees it, or the prompt can be refused, so a turn that stops
  // producing text also ends after a short silence.
  const scheduleIdle = (delay: number) => {
    clearIdle()
    idleTimer = setTimeout(() => {
      idleTimer = undefined

      if (closed || finished || working || interrupted) return

      finishTurn()
    }, delay)
  }

  // Barge-in: the first frames of the user's voice stop the answer instead of being transcribed over
  // it. Four frames is 80 ms, short enough to feel immediate.
  const interrupt = () => {
    interrupted = true
    clearIdle()
    queue.length = 0
    pending = ""
    speaker?.stop()
    setState(working ? "thinking" : "listening")
  }

  const onFrame = (frame: RecorderFrame) => {
    frames.push(frame.samples)

    for (const segment of segmenter.push(frame.level, frame.samples.length)) {
      if (state() === "listening") void onSegment(segment)
      else if (interrupted) deferred = segment
    }

    if (state() !== "speaking") {
      loud = 0

      return
    }

    loud = frame.level > 0.04 ? loud + 1 : 0

    if (loud >= 4) interrupt()
  }

  const onSegment = async (segment: SpeechSegment) => {
    if (closed || state() !== "listening") return

    setState("thinking")

    try {
      const text = await platform.voiceLocal!.transcribe({
        audio: floatToPcm16([sliceSamples(frames, segment.start, segment.end)]),
        id: model,
        language: spoken,
        prompt: vocabulary,
      })

      if (closed) return

      if (!text) {
        setState("listening")

        return
      }

      setHeard(text)
      setReply("")
      setFailure(undefined)

      const current = props.composer.value()
      const draft = current.trim() ? `${current} ${text}` : text

      turnFrom = props.session.history.messages().length
      unseen = 0
      pending = ""
      working = false
      finished = false
      interrupted = false

      props.composer.onInput(draft)
      props.composer.submit()
      scheduleIdle(4000)
    } catch {
      if (!closed) fail(language.t("assistant.dictation.error.transcribe"))
    }
  }

  createEffect(
    on(
      () => props.session.history.messages(),
      (messages) => {
        if (turnFrom < 0 || closed) return

        const text = messages
          .slice(turnFrom)
          .flatMap((message) => (message.type === "assistant" ? message.content : []))
          .flatMap((content) => (content.type === "text" ? [content.text] : []))
          .join("\n\n")

        if (!text) return

        setReply(text)

        const delta = text.slice(unseen)

        unseen = text.length
        pending += delta

        const split = splitSentences(pending)

        pending = split.rest
        enqueue(split.sentences)

        if (!working) scheduleIdle(800)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => props.session.data.working(),
      (running) => {
        if (closed || turnFrom < 0) return

        if (running) {
          working = true
          clearIdle()
          setState((current) => (current === "speaking" ? current : "thinking"))

          return
        }

        if (!working) return

        working = false

        // A barge-in stopped the answer while it was still being written. The run finishes silently,
        // then the sentence spoken over it becomes the next turn.
        if (interrupted) {
          interrupted = false
          finished = true
          pending = ""
          setState("listening")

          if (deferred) void onSegment(deferred)
          deferred = undefined

          return
        }

        finishTurn()
      },
      { defer: true },
    ),
  )

  // A permission request cannot be answered by voice, so the call ends and the conversation keeps
  // the request on screen.
  createEffect(
    on(
      () => {
        const sessionID = props.session.identity.sessionID()

        return sessionID ? (data.session.permission.list(sessionID)?.length ?? 0) : 0
      },
      (permissions) => {
        if (!permissions || closed) return

        showToast({ title: language.t("assistant.voice.permission") })
        close()
      },
      { defer: true },
    ),
  )

  onMount(async () => {
    await voice.refetch()

    const preferences = await platform.voiceLocal!.preferences()

    spoken = preferences.language ?? dictationLanguage(language.locale())
    vocabulary = preferences.prompt

    if (!voice.best()) {
      setFailure(language.t("assistant.voice.noModel"))

      return
    }

    if (!voice.synthesis()) {
      setFailure(language.t("assistant.voice.noSpeech"))

      return
    }

    model = voice.best()
    speaker = createSpeaker((text) => platform.voiceLocal!.speak({ text }))

    try {
      recorder = await startRecorder({ onFrame })
      frames = []
      segmenter = createSpeechSegmenter()
      setState("listening")
    } catch {
      fail(language.t("assistant.dictation.error.microphone"))
    }
  })

  onCleanup(() => {
    closed = true
    clearIdle()
    void recorder?.cancel()
    speaker?.stop()
    speaker?.dispose()
  })

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>{language.t("assistant.voice.call")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex min-h-[320px] flex-col gap-4">
        <Show
          when={failure() === undefined}
          fallback={
            <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Icon name="circle-exclamation" class="text-v2-icon-icon-muted" />
              <span class="max-w-[280px] text-[13px] text-v2-text-text-muted">{failure()}</span>
              <Button variant="ghost-muted" onClick={() => settings.open("voice")}>
                {language.t("assistant.voice.speechSettings")}
              </Button>
            </div>
          }
        >
          <div class="flex items-center gap-2" data-voice-call-state={state()}>
            <span class={`size-2 rounded-full ${STATE_DOT[state()]}`} />
            <span class="text-[13px] text-v2-text-text-muted">{language.t(STATE_LABEL[state()])}</span>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <Show when={heard()}>
              <div class="mb-3">
                <span class="text-[11px] text-v2-text-text-faint">{language.t("assistant.voice.you")}</span>
                <p class="text-[14px] text-v2-text-text-base">{heard()}</p>
              </div>
            </Show>
            <Show when={reply()}>
              <div class="mb-3">
                <span class="text-[11px] text-v2-text-text-faint">{language.t("assistant.voice.assistant")}</span>
                <p class="whitespace-pre-wrap text-[14px] text-v2-text-text-base">{reply()}</p>
              </div>
            </Show>
            <Show when={!heard() && !reply()}>
              <p class="text-[13px] text-v2-text-text-faint">{language.t("assistant.voice.callHint")}</p>
            </Show>
          </div>

          <Button class="w-full" variant="contrast" onClick={close} data-action="voice-call-end">
            {language.t("assistant.voice.end")}
          </Button>
        </Show>
      </DialogBody>
    </Dialog>
  )
}
