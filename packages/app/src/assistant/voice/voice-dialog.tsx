import { createResource, createSignal, For, Show, onCleanup } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { Icon } from "@opencode/ui/icon"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useServerSDK } from "@/runtime/server/client"
import { useSettingsSurface } from "@/settings/surface"
import { startVoiceSession, pickVoiceModel, type VoiceHandle, type VoicePhase } from "./voice-session"

const PHASE_LABEL: Record<
  VoicePhase,
  "assistant.voice.connecting" | "assistant.voice.ready" | "assistant.voice.listening" | "assistant.voice.responding"
> = {
  connecting: "assistant.voice.connecting",
  ready: "assistant.voice.ready",
  listening: "assistant.voice.listening",
  responding: "assistant.voice.responding",
}

/** Micro entry point in the composer action row, assistant mode only. */
export function AssistantVoiceButton() {
  const platform = usePlatform()
  const dialog = useDialog()
  const language = useLanguage()

  return (
    <Show when={!!platform.assistantDirectory}>
      <Button
        data-action="assistant-voice"
        variant="ghost-faint"
        size="small"
        onClick={() => dialog.show(() => <VoiceOverlay />)}
      >
        <Icon name="microphone" class="shrink-0 text-v2-icon-icon-muted" />
        <span class="hidden sm:block">{language.t("assistant.voice.action")}</span>
      </Button>
    </Show>
  )
}

function VoiceOverlay() {
  const sdk = useServerSDK()
  const language = useLanguage()
  const settings = useSettingsSurface()

  const [phase, setPhase] = createSignal<VoicePhase>("connecting")
  const [failure, setFailure] = createSignal<string | null>(null)
  const [session, setSession] = createSignal<VoiceHandle | null>(null)
  const [turns, setTurns] = createSignal<Array<{ side: "user" | "assistant"; text: string }>>([])

  const describeError = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error)

    return raw.startsWith("voice: ") ? raw.slice("voice: ".length) : raw
  }

  const appendUser = (text: string) => setTurns((current) => [...current, { side: "user", text }])

  const appendAssistant = (delta: string) =>
    setTurns((current) => {
      if (!delta) return current
      const last = current.at(-1)

      return last && last.side === "assistant"
        ? [...current.slice(0, -1), { side: "assistant", text: last.text + delta }]
        : [...current, { side: "assistant", text: delta }]
    })

  const stop = () => {
    session()?.dispose()
    setSession(null)
  }

  onCleanup(stop)

  const [models] = createResource(async () => await sdk.api.voice.models())

  const available = () => pickVoiceModel(models.latest?.models ?? [])

  void (async () => {
    await models()

    const model = available()

    if (!model) {
      setFailure(language.t("assistant.voice.noModel"))

      return
    }

    setPhase("connecting")
    try {
      const handle = await startVoiceSession({
        sdk,
        model,
        onEvent: (event) => {
          if (event.type === "phase") setPhase(event.phase)
          else if (event.type === "user") appendUser(event.text)
          else if (event.type === "assistant") appendAssistant(event.delta)
          else setFailure(describeError(event.message))
        },
      })
      setSession(handle)
    } catch (error) {
      setFailure(describeError(error))
    }
  })()

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>{session()?.model.model ?? language.t("assistant.voice.action")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex min-h-[320px] flex-col gap-4">
        <Show
          when={failure() === null}
          fallback={
            <div class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <Icon name="circle-exclamation" class="text-v2-icon-icon-muted" />
              <span class="max-w-[280px] text-[13px] text-v2-text-text-muted">{failure()}</span>
              <Button variant="ghost-muted" onClick={() => settings.open("extensions")}>
                {language.t("assistant.voice.connectors")}
              </Button>
            </div>
          }
        >
          <div class="flex items-center gap-2" data-voice-phase={phase()}>
            <span
              class={`size-2 rounded-full ${
                phase() === "connecting"
                  ? "bg-v2-icon-icon-muted"
                  : phase() === "listening"
                    ? "bg-v2-icon-icon-accent animate-pulse"
                    : "bg-v2-icon-icon-base"
              }`}
            />
            <span class="text-[13px] text-v2-text-text-muted">{language.t(PHASE_LABEL[phase()])}</span>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <For each={turns()}>
              {(turn) => (
                <div class="mb-2">
                  <span class="text-[11px] text-v2-text-text-faint">
                    {turn.side === "user" ? language.t("assistant.voice.you") : language.t("assistant.voice.assistant")}
                  </span>
                  <p class="text-[14px] text-v2-text-text-base">{turn.text}</p>
                </div>
              )}
            </For>
            <Show when={turns().length === 0}>
              <p class="text-[13px] text-v2-text-text-faint">{language.t("assistant.voice.empty")}</p>
            </Show>
          </div>
        </Show>
      </DialogBody>
    </Dialog>
  )
}
