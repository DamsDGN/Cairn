import { Component, For, Show, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js"
import { Button } from "@opencode/ui/button"
import { Select } from "@opencode/ui/select"
import { TextInput } from "@opencode/ui/text-input"
import { useLanguage } from "@/runtime/i18n/language"
import { DESKTOP_NATIVE_LABELS, type DesktopNativeLocale } from "@/runtime/i18n/desktop-native"
import {
  usePlatform,
  type VoiceLocalLanguage,
  type VoiceLocalModelID,
  type VoiceLocalPreferences,
} from "@/runtime/platform/platform"
import { dictationLanguage, dictationLanguages } from "@/assistant/voice/languages"
import { useVoiceModels } from "@/assistant/voice/models"
import { DEFAULT_VOICE } from "@/assistant/voice/voices"
import { VoiceModelRow, VOICE_LABEL } from "@/assistant/voice/model-row"
import { createSpeaker, type Speaker } from "@/assistant/voice/tts"
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

  const voiceLanguage = createMemo<VoiceLocalLanguage>(() => {
    const selected = voice.models().find((model) => model.id === draft().voice)?.language

    if (selected) return selected

    return language.locale().startsWith("en") ? "en" : "fr"
  })

  const voiceLanguages = createMemo<Array<{ value: VoiceLocalLanguage; label: string }>>(() => [
    { value: "fr", label: language.t("settings.voice.voiceLanguage.fr") },
    { value: "en", label: language.t("settings.voice.voiceLanguage.en") },
  ])

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

  const speechModels = createMemo(() => voice.models().filter((model) => model.kind !== "synthesis"))

  // Only installed voices can be listened to or selected, which is what the dropdown offers; the
  // list below installs and removes them.
  const installedVoices = createMemo(() => voice.voices(voiceLanguage()).filter((model) => model.installed))

  const selectedVoice = createMemo<VoiceLocalModelID | undefined>(() => {
    const chosen = draft().voice

    if (chosen && installedVoices().some((model) => model.id === chosen)) return chosen

    return installedVoices()[0]?.id ?? DEFAULT_VOICE[voiceLanguage()]
  })

  let speaker: Speaker | undefined
  let speaking: VoiceLocalModelID = "vits-piper-fr_FR-siwis-medium"

  onCleanup(() => speaker?.dispose())

  const listen = async () => {
    const id = selectedVoice()

    if (!id) return

    speaking = id
    speaker ??= createSpeaker((text) => platform.voiceLocal!.speak({ text, id: speaking }))

    const model = voice.models().find((entry) => entry.id === id)

    await speaker.speak(
      model?.language === "en" ? "Hello, I am Cairn. This is my voice." : "Bonjour, je suis Cairn. Voici ma voix.",
    )
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

          <div class="settings-section">
            <h3 class="settings-section-title">{language.t("settings.voice.voice.title")}</h3>
            <p class="text-11-regular text-v2-text-text-muted">{language.t("settings.voice.voice.description")}</p>
            <SettingsList>
              <SettingsRow
                title={language.t("settings.voice.voiceLanguage.title")}
                description={language.t("settings.voice.voiceLanguage.description")}
              >
                <Select
                  data-action="settings-voice-language"
                  options={voiceLanguages()}
                  current={voiceLanguages().find((option) => option.value === voiceLanguage())}
                  value={(option) => option.value}
                  label={(option) => option.label}
                  placement="bottom-end"
                  gutter={6}
                  onSelect={(option) => option && save({ voice: DEFAULT_VOICE[option.value] })}
                />
              </SettingsRow>
              <SettingsRow
                title={language.t("settings.voice.voiceSelect.title")}
                description={language.t("settings.voice.voiceSelect.description")}
              >
                <div class="flex items-center gap-2">
                  <Select
                    data-action="settings-voice-select"
                    options={installedVoices()}
                    current={installedVoices().find((model) => model.id === selectedVoice())}
                    value={(model) => model.id}
                    label={(model) => language.t(VOICE_LABEL[model.id])}
                    placement="bottom-end"
                    gutter={6}
                    disabled={installedVoices().length === 0}
                    onSelect={(model) => model && save({ voice: model.id })}
                  />
                  <Button
                    variant="outline"
                    size="small"
                    data-action="settings-voice-preview"
                    disabled={!selectedVoice()}
                    onClick={() => void listen()}
                  >
                    {language.t("settings.voice.model.preview")}
                  </Button>
                </div>
              </SettingsRow>
              <For each={voice.voices(voiceLanguage())}>
                {(model) => (
                  <VoiceModelRow model={model} voice={voice} />
                )}
              </For>
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
              <For each={speechModels()}>{(model) => <VoiceModelRow model={model} voice={voice} />}</For>
            </SettingsList>
          </div>
        </Show>
      </div>
    </>
  )
}
