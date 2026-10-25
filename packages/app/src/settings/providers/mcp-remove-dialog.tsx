import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { createSignal } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useData } from "@/runtime/server/current"
import { useServerSDK } from "@/runtime/server/client"
import { showToast } from "@/shell/notifications/toast"

export function DialogMcpRemove(props: { name: string; onRemoved?: () => void }) {
  const dialog = useDialog()
  const language = useLanguage()
  const platform = usePlatform()
  const serverSDK = useServerSDK()
  const data = useData()
  const [busy, setBusy] = createSignal(false)

  const location = () => {
    const value = platform.assistantDirectory

    return value ? { directory: value } : undefined
  }

  const remove = async () => {
    if (busy() || !platform.assistantMcp) return

    setBusy(true)
    const result = await platform.assistantMcp.remove(props.name).catch(() => undefined)

    if (!result?.ok) {
      setBusy(false)
      showToast({ title: language.t("dialog.mcp.remove.error"), variant: "error" })

      return
    }

    // The file is the source of truth, so a failed runtime removal only leaves the server listed
    // until the next reload instead of blocking the deletion.
    await serverSDK.api.mcp.remove({ server: props.name, location: location() }).catch(() => undefined)
    data.location.mcp.server.invalidate(location())
    await data.location.mcp.server.sync(location()).catch(() => undefined)
    await props.onRemoved?.()
    setBusy(false)
    dialog.close()
  }

  return (
    <Dialog fit>
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("dialog.mcp.remove.title")}
          description={language.t("dialog.mcp.remove.description", { name: props.name })}
        />
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button variant="danger" disabled={busy()} onClick={() => void remove()}>
          {language.t("common.delete")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
