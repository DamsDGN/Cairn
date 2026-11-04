import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useCommand } from "@/shell/commands/command"
import { dictationCapture } from "./voice/dictation-capture"

// The global shortcut and the tray reach this command through the menu-command channel. A capture
// opens a new conversation in the assistant folder and arms it, so its composer starts dictation;
// the same shortcut pressed while recording stops and keeps the text.
export function AssistantQuickCapture() {
  const command = useCommand()
  const platform = usePlatform()
  const language = useLanguage()

  command.register("assistant-quick-capture", () => {
    if (!platform.assistantDirectory) return []

    return [
      {
        id: "assistant.quickCapture",
        title: language.t("assistant.quickCapture"),
        hidden: true,
        onSelect: () => {
          if (dictationCapture.stop()) return

          command.trigger("tab.new")
          dictationCapture.request()
        },
      },
    ]
  })

  return null
}
