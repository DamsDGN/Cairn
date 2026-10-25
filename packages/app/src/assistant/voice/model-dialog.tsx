import { For } from "solid-js"
import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { useLanguage } from "@/runtime/i18n/language"
import { VoiceModelRow } from "./model-row"
import { useVoiceModels } from "./models"

/** Offered the first time someone dictates without a model, and from the settings page. */
export function DialogVoiceModels(props?: { onInstalled?: () => void }) {
  const language = useLanguage()
  const dialog = useDialog()
  const voice = useVoiceModels()

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>{language.t("assistant.dictation.model.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="flex flex-col gap-2">
        <p class="text-[13px] text-v2-text-text-muted">{language.t("assistant.dictation.model.description")}</p>
        <For each={voice.speech()}>
          {(model) => <VoiceModelRow model={model} voice={voice} onInstalled={props?.onInstalled} />}
        </For>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost-muted" onClick={() => dialog.close()}>
          {language.t("common.close")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
