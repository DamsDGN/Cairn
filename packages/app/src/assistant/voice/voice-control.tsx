import { Show } from "solid-js"
import type { ComposerModel } from "@/composer/model"
import { usePlatform } from "@/runtime/platform/platform"
import { AssistantDictationButton } from "./dictation"
import { AssistantVoiceButton } from "./voice-dialog"

// The desktop build records and transcribes on the machine; the hosted realtime path stays the
// fallback where no local voice bridge exists.
export function AssistantVoiceControls(props: { composer: ComposerModel }) {
  const platform = usePlatform()

  return (
    <Show when={platform.assistantDirectory ? platform.voiceLocal : undefined} fallback={<AssistantVoiceButton />}>
      <AssistantDictationButton composer={props.composer} />
    </Show>
  )
}
