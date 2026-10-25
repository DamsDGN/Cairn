import { Component, For, Show, createResource } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useVoiceModels } from "@/assistant/voice/models"
import { VoiceModelRow } from "@/assistant/voice/model-row"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import "@/settings/settings.css"

export const SettingsVoice: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()
  const voice = useVoiceModels()
  // The kernel choice only exists on Linux x64, where the application ships a second, faster addon
  // next to the portable one.
  const [level] = createResource(async () => (await platform.voiceLocal?.acceleration())?.level ?? "compatible")

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
          <Show when={platform.os === "linux"}>
            <div class="settings-section">
              <h3 class="settings-section-title">{language.t("settings.voice.acceleration.title")}</h3>
              <SettingsList>
                <SettingsRow
                  title={language.t("settings.voice.acceleration.row")}
                  description={language.t(
                    level() === "avx2"
                      ? "settings.voice.acceleration.avx2.description"
                      : "settings.voice.acceleration.compatible.description",
                  )}
                >
                  <span data-voice-acceleration={level()}>
                    {language.t(
                      level() === "avx2"
                        ? "settings.voice.acceleration.avx2"
                        : "settings.voice.acceleration.compatible",
                    )}
                  </span>
                </SettingsRow>
              </SettingsList>
            </div>
          </Show>

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
