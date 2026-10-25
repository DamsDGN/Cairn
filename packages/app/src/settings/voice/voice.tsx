import { Component, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useVoiceModels } from "@/assistant/voice/models"
import { VoiceModelRow } from "@/assistant/voice/model-row"
import { SettingsList } from "@/settings/list"
import "@/settings/settings.css"

export const SettingsVoice: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()
  const voice = useVoiceModels()

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("settings.voice.title")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">{language.t("settings.voice.description")}</span>
          </div>
        </div>
      </div>

      <div class="settings-tab-body settings-tab-body--sectioned">
        <Show
          when={platform.voiceLocal}
          fallback={
            <div class="settings-section">
              <p class="text-11-regular text-v2-text-text-muted">{language.t("settings.voice.unavailable")}</p>
            </div>
          }
        >
          <div class="settings-section">
            <h3 class="settings-section-title">{language.t("settings.voice.models")}</h3>
            <SettingsList>
              <For each={voice.models()}>{(model) => <VoiceModelRow model={model} voice={voice} />}</For>
            </SettingsList>
          </div>
        </Show>
      </div>
    </>
  )
}
