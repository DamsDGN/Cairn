// A call started before the conversation exists. It only captures the first sentence, hands it to
// the new-session composer, which creates the conversation and routes to it; the session screen then
// opens the real call dialog and the answer is spoken there.
import { Show, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import type { ComposerModel } from "@/composer/model"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform, type VoiceLocalModelID } from "@/runtime/platform/platform"
import { useSettingsSurface } from "@/settings/surface"
import { dictationLanguage } from "./languages"
import { useVoiceModels } from "./models"
import { floatToPcm16, sliceSamples } from "./pcm"
import { pendingVoiceCall } from "./pending-call"
import { startRecorder, type Recorder, type RecorderFrame } from "./recorder"
import { createSpeechSegmenter, type SpeechSegment } from "./segmenter"
import "./call-dialog.css"

type DraftState = "starting" | "listening" | "sending" | "error"

export function VoiceDraftCallDialog(props: { composer: ComposerModel; onClose: () => void }) {
  const platform = usePlatform()
  const language = useLanguage()
  const voice = useVoiceModels()
  const settings = useSettingsSurface()

  const [state, setState] = createSignal<DraftState>("starting")
  const [failure, setFailure] = createSignal<string>()

  let recorder: Recorder | undefined
  let segmenter = createSpeechSegmenter()
  let frames: Float32Array[] = []
  let model: VoiceLocalModelID | undefined
  let spoken = "fr"
  let vocabulary: string | undefined
  let closed = false
  let sending = false

  const close = () => {
    if (closed) return
    closed = true
    void recorder?.cancel()
    recorder = undefined
    props.onClose()
  }

  const fail = (message: string) => {
    setFailure(message)
    setState("error")
  }

  const onFrame = (frame: RecorderFrame) => {
    frames.push(frame.samples)

    if (closed || sending || state() !== "listening") return

    const segments = segmenter.push(frame.level, frame.samples.length)
    const segment = segments.at(-1)

    if (segment) void send(segment)
  }

  const send = async (segment: SpeechSegment) => {
    if (!model) return

    sending = true
    setState("sending")

    try {
      const text = await platform.voiceLocal!.transcribe({
        audio: floatToPcm16([sliceSamples(frames, segment.start, segment.end)]),
        id: model,
        language: spoken,
        prompt: vocabulary,
      })

      if (closed) return

      if (!text) {
        sending = false
        setState("listening")

        return
      }

      props.composer.onInput(text)
      pendingVoiceCall.arm()
      props.composer.submit()
      close()
    } catch {
      if (!closed) fail(language.t("assistant.dictation.error.transcribe"))
    }
  }

  onMount(async () => {
    await voice.refetch()

    const preferences = await platform.voiceLocal!.preferences()

    spoken = preferences.language ?? dictationLanguage(language.locale())
    vocabulary = preferences.prompt
    model = voice.best()

    if (!model) {
      fail(language.t("assistant.voice.noModel"))

      return
    }

    try {
      recorder = await startRecorder({ onFrame })
      segmenter = createSpeechSegmenter()
      frames = []
      setState("listening")
    } catch {
      fail(language.t("assistant.dictation.error.microphone"))
    }
  })

  onCleanup(() => {
    closed = true
    void recorder?.cancel()
  })

  return (
    <Dialog containerClass="voice-call">
      <DialogHeader>
        <DialogTitle>{language.t("assistant.voice.call")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="voice-call-body">
        <Show
          when={failure() === undefined}
          fallback={
            <div class="voice-call-error">
              <Icon name="circle-exclamation" class="text-v2-icon-icon-muted" />
              <span class="voice-call-error-text">{failure()}</span>
              <Button variant="ghost-muted" onClick={() => settings.open("voice")}>
                {language.t("assistant.voice.speechSettings")}
              </Button>
            </div>
          }
        >
          <div class="voice-call-stage" data-voice-call-state={state()}>
            <span class="voice-call-orb" data-state={state() === "sending" ? "thinking" : state()} aria-hidden="true">
              <span class="voice-call-orb-glow" />
              <span class="voice-call-orb-core" />
              <span class="voice-call-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </span>
            <div class="voice-call-state">
              <span class={`voice-call-dot ${state() === "listening" ? "animate-pulse bg-v2-icon-icon-accent" : "bg-v2-icon-icon-muted"}`} />
              <span>
                {language.t(
                  state() === "sending" ? "assistant.voice.responding" : "assistant.voice.listening",
                )}
              </span>
            </div>
          </div>

          <div class="voice-call-transcript">
            <p class="voice-call-hint">{language.t("assistant.voice.callDraftHint")}</p>
          </div>

          <div class="voice-call-actions">
            <Button variant="danger" class="w-full" onClick={close} data-action="voice-call-end">
              {language.t("assistant.voice.end")}
            </Button>
          </div>
        </Show>
      </DialogBody>
    </Dialog>
  )
}
