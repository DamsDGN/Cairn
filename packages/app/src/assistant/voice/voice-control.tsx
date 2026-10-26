import { Show, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Icon } from "@opencode/ui/icon"
import type { ComposerModel } from "@/composer/model"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import type { SessionModel } from "@/session/model"
import { VoiceCallDialog } from "./call-dialog"
import { AssistantDictationButton } from "./dictation"
import { VoiceDraftCallDialog } from "./draft-call"
import { pendingVoiceCall } from "./pending-call"
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

// The conversation needs a session to write into. From a new chat the call creates that session with
// its first sentence, then carries on in the conversation it just opened.
function AssistantCallButton(props: { composer: ComposerModel; session?: SessionModel }) {
  return (
    <Show when={props.session} fallback={<DraftCallButton composer={props.composer} />}>
      {(session) => <SessionCallButton composer={props.composer} session={session()} />}
    </Show>
  )
}

function CallTrigger(props: { onClick: () => void }) {
  const language = useLanguage()

  return (
    <Button data-action="assistant-voice-call" variant="ghost-faint" size="small" onClick={() => props.onClick()}>
      <Icon name="waveform" class="shrink-0 text-v2-icon-icon-muted" />
      <span class="hidden sm:block">{language.t("assistant.voice.call")}</span>
    </Button>
  )
}

function DraftCallButton(props: { composer: ComposerModel }) {
  const dialog = useDialog()

  return (
    <CallTrigger
      onClick={() =>
        dialog.show(() => <VoiceDraftCallDialog composer={props.composer} onClose={() => dialog.close()} />)
      }
    />
  )
}

function SessionCallButton(props: { composer: ComposerModel; session: SessionModel }) {
  const dialog = useDialog()

  const open = () =>
    dialog.show(() => (
      <VoiceCallDialog session={props.session} composer={props.composer} onClose={() => dialog.close()} />
    ))

  // A call handed over from a new chat opens here, where the answer can be spoken.
  onMount(() => {
    if (pendingVoiceCall.take()) open()
  })

  return <CallTrigger onClick={open} />
}
