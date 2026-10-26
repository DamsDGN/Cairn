import { Show } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Icon } from "@opencode/ui/icon"
import type { ComposerModel } from "@/composer/model"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import type { SessionModel } from "@/session/model"
import { VoiceCallDialog } from "./call-dialog"
import { AssistantDictationButton } from "./dictation"
import { AssistantVoiceButton } from "./voice-dialog"

// The desktop build records, transcribes and synthesizes on the machine; the hosted realtime path
// stays the fallback where no local voice bridge exists.
export function AssistantVoiceControls(props: { composer: ComposerModel; session?: SessionModel }) {
  const platform = usePlatform()

  return (
    <Show when={platform.assistantDirectory ? platform.voiceLocal : undefined} fallback={<AssistantVoiceButton />}>
      <AssistantCallButton composer={props.composer} session={props.session} />
      <AssistantDictationButton composer={props.composer} />
    </Show>
  )
}

// The conversation needs a session to write into, so a new chat only offers dictation.
function AssistantCallButton(props: { composer: ComposerModel; session?: SessionModel }) {
  const dialog = useDialog()
  const language = useLanguage()

  return (
    <Show when={props.session}>
      {(session) => (
        <Button
          data-action="assistant-voice-call"
          variant="ghost-faint"
          size="small"
          onClick={() =>
            dialog.show(() => (
              <VoiceCallDialog session={session()} composer={props.composer} onClose={() => dialog.close()} />
            ))
          }
        >
          <Icon name="waveform" class="shrink-0 text-v2-icon-icon-muted" />
          <span class="hidden sm:block">{language.t("assistant.voice.call")}</span>
        </Button>
      )}
    </Show>
  )
}
