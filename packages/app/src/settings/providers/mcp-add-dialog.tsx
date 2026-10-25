import { Button } from "@opencode/ui/button"
import { useDialog } from "@opencode/ui/context/dialog"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { Tabs } from "@opencode/ui/tabs"
import { TextInput } from "@opencode/ui/text-input"
import { createSignal } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform, type AssistantMcpConfig, type AssistantMcpResult } from "@/runtime/platform/platform"
import { useData } from "@/runtime/server/current"
import { useServerSDK } from "@/runtime/server/client"
import "@/settings/settings.css"

type Kind = "remote" | "local"

export function DialogMcpAdd(props: { existing: string[]; onAdded?: () => void }) {
  const language = useLanguage()
  const platform = usePlatform()
  const serverSDK = useServerSDK()
  const data = useData()
  const dialog = useDialog()

  const [kind, setKind] = createSignal<Kind>("remote")
  const [name, setName] = createSignal("")
  const [url, setUrl] = createSignal("")
  const [command, setCommand] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")

  const location = () => {
    const value = platform.assistantDirectory

    return value ? { directory: value } : undefined
  }

  const reason = (failure: AssistantMcpResult["error"]) => {
    if (failure === "not-ready") return language.t("dialog.mcp.add.error.notReady")
    if (failure === "invalid-config") return language.t("dialog.mcp.add.error.invalidConfig")

    return language.t("dialog.mcp.add.error.generic")
  }

  const config = (): AssistantMcpConfig | string => {
    if (!/^[a-zA-Z0-9_-]+$/.test(name().trim())) return language.t("dialog.mcp.add.error.name")

    if (props.existing.includes(name().trim())) return language.t("dialog.mcp.add.error.exists")

    if (kind() === "remote") {
      const value = url().trim()

      if (!URL.canParse(value) || !/^https?:$/i.test(new URL(value).protocol)) {
        return language.t("dialog.mcp.add.error.url")
      }

      return { type: "remote", url: value }
    }

    const parts = command().trim().split(/\s+/).filter(Boolean)

    if (parts.length === 0) return language.t("dialog.mcp.add.error.command")

    return { type: "local", command: parts }
  }

  const submit = async () => {
    if (busy()) return
    setError("")

    const value = config()

    if (typeof value === "string") return setError(value)

    if (!platform.assistantMcp) return setError(language.t("dialog.mcp.add.error.generic"))

    const server = name().trim()
    setBusy(true)
    const result = await platform.assistantMcp.add(server, value).catch(() => undefined)
    setBusy(false)

    if (!result?.ok) return setError(reason(result?.error))

    // The file is the source of truth; the runtime call only makes the server usable now, and a
    // failed connection is reported by its row instead of blocking the saved configuration.
    await serverSDK.api.mcp.add({ server, config: value, location: location() }).catch(() => undefined)
    data.location.mcp.server.invalidate(location())
    await data.location.mcp.server.sync(location()).catch(() => undefined)
    await props.onAdded?.()
    dialog.close()
  }

  const keyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    void submit()
  }

  return (
    <Dialog fit class="settings-server-dialog">
      <DialogHeader hideClose>
        <DialogTitleGroup
          title={language.t("dialog.mcp.add.title")}
          description={language.t("dialog.mcp.add.description")}
        />
      </DialogHeader>
      <DialogBody class="flex w-full min-w-0 flex-1 flex-col gap-4 px-4 pt-4 pb-2">
        <Tabs
          variant="pill"
          value={kind()}
          onChange={(value) => {
            if (value !== "remote" && value !== "local") return
            setKind(value)
            setError("")
          }}
        >
          <Tabs.List>
            <Tabs.Trigger value="remote">{language.t("dialog.mcp.add.kind.remote")}</Tabs.Trigger>
            <Tabs.Trigger value="local">{language.t("dialog.mcp.add.kind.local")}</Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {kind() === "remote" ? (
          <div class="flex w-full min-w-0 flex-col gap-2">
            <label for="dialog-mcp-url" class="settings-server-dialog-label">
              {language.t("dialog.mcp.add.url")}
            </label>
            <TextInput
              id="dialog-mcp-url"
              appearance="large"
              class="!w-full self-stretch"
              dir="ltr"
              spellcheck={false}
              autocapitalize="off"
              value={url()}
              placeholder={language.t("dialog.mcp.add.urlPlaceholder")}
              invalid={!!error()}
              disabled={busy()}
              autofocus
              onInput={(event) => {
                setUrl(event.currentTarget.value)
                setError("")
              }}
              onKeyDown={keyDown}
            />
          </div>
        ) : (
          <div class="flex w-full min-w-0 flex-col gap-2">
            <label for="dialog-mcp-command" class="settings-server-dialog-label">
              {language.t("dialog.mcp.add.command")}
            </label>
            <TextInput
              id="dialog-mcp-command"
              appearance="large"
              class="!w-full self-stretch"
              dir="ltr"
              spellcheck={false}
              autocapitalize="off"
              value={command()}
              placeholder={language.t("dialog.mcp.add.commandPlaceholder")}
              invalid={!!error()}
              disabled={busy()}
              autofocus
              onInput={(event) => {
                setCommand(event.currentTarget.value)
                setError("")
              }}
              onKeyDown={keyDown}
            />
            <span class="text-11-regular text-v2-text-text-muted">{language.t("dialog.mcp.add.commandHint")}</span>
          </div>
        )}

        <div class="flex w-full min-w-0 flex-col gap-2">
          <label for="dialog-mcp-name" class="settings-server-dialog-label">
            {language.t("dialog.mcp.add.name")}
          </label>
          <TextInput
            id="dialog-mcp-name"
            appearance="large"
            class="!w-full self-stretch"
            dir="ltr"
            spellcheck={false}
            autocapitalize="off"
            value={name()}
            placeholder={language.t("dialog.mcp.add.namePlaceholder")}
            disabled={busy()}
            onInput={(event) => {
              setName(event.currentTarget.value)
              setError("")
            }}
            onKeyDown={keyDown}
          />
        </div>

        {error() ? (
          <p id="dialog-mcp-error" class="settings-server-dialog-error" role="alert">
            {error()}
          </p>
        ) : undefined}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={() => dialog.close()}>
          {language.t("common.cancel")}
        </Button>
        <Button variant="submit" disabled={busy()} onClick={() => void submit()}>
          {language.t("dialog.mcp.add.submit")}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
