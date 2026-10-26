import { Component, For, Show, createMemo, createResource, createSignal, onMount } from "solid-js"
import { Select } from "@opencode/ui/select"
import { TextInput } from "@opencode/ui/text-input"
import { useLanguage } from "@/runtime/i18n/language"
import { DESKTOP_NATIVE_LABELS, type DesktopNativeLocale } from "@/runtime/i18n/desktop-native"
import { usePlatform, type VoiceLocalPreferences } from "@/runtime/platform/platform"
import { dictationLanguage, dictationLanguages } from "@/assistant/voice/languages"
import { useVoiceModels } from "@/assistant/voice/models"
import { VoiceModelRow } from "@/assistant/voice/model-row"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import "@/settings/settings.css"

const PROMPT_LIMIT = 200

export const SettingsVoice: Component = () => {
  const language = useLanguage()
  const platform = usePlatform()
  const voice = useVoiceModels()

  const [draft, setDraft] = createSignal<VoiceLocalPreferences>({})

  onMount(async () => {
    setDraft((await platform.voiceLocal?.preferences()) ?? {})
  })

  // The kernel choice only exists on Linux x64, where the application ships a second, faster addon
  // next to the portable one.
  const [level] = createResource(async () => (await platform.voiceLocal?.acceleration())?.level ?? "compatible")

  const languages = createMemo(() =>
    dictationLanguages(language.locales).map((code) => ({
      value: code,
      label: DESKTOP_NATIVE_LABELS[code as DesktopNativeLocale] ?? code,
    })),
  )

  const spoken = () => draft().language ?? dictationLanguage(language.locale())

  const save = (patch: VoiceLocalPreferences) => {
    const next = { ...draft(), ...patch }

    setDraft(next)
    void platform.voiceLocal?.setPreferences(next)
  }

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
            <h3 class="settings-section-title">{language.t("settings.voice.dictation.title")}</h3>
            <SettingsList>
              <SettingsRow
                title={language.t("settings.voice.dictation.language.title")}
                description={language.t("settings.voice.dictation.language.description")}
              >
                <Select
                  data-action="settings-dictation-language"
                  options={languages()}
                  current={languages().find((option) => option.value === spoken())}
                  value={(option) => option.value}
                  label={(option) => option.label}
                  placement="bottom-end"
                  gutter={6}
                  onSelect={(option) => option && save({ language: option.value })}
                />
              </SettingsRow>
              <SettingsRow
                title={language.t("settings.voice.dictation.vocabulary.title")}
                description={language.t("settings.voice.dictation.vocabulary.description")}
              >
                <TextInput
                  data-action="settings-dictation-vocabulary"
                  class="w-56"
                  value={draft().prompt ?? ""}
                  maxLength={PROMPT_LIMIT}
                  placeholder={language.t("settings.voice.dictation.vocabulary.placeholder")}
                  onInput={(event) => setDraft({ ...draft(), prompt: event.currentTarget.value })}
                  onBlur={() => save({ prompt: draft().prompt })}
                />
              </SettingsRow>
            </SettingsList>
          </div>

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
            <p class="text-11-regular text-v2-text-text-muted">{language.t("settings.voice.models.description")}</p>
            <SettingsList>
              <For each={voice.models()}>{(model) => <VoiceModelRow model={model} voice={voice} />}</For>
            </SettingsList>
          </div>
        </Show>
      </div>
    </>
  )
}
