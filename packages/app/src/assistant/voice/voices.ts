import type { VoiceLocalLanguage, VoiceLocalModelID } from "@/runtime/platform/platform"

/** Voice used until the user picks another one, per spoken language. */
export const DEFAULT_VOICE: Record<VoiceLocalLanguage, VoiceLocalModelID> = {
  fr: "vits-piper-fr_FR-siwis-medium",
  en: "vits-piper-en_US-lessac-medium",
}

export function defaultVoice(locale: string): VoiceLocalModelID {
  return locale.startsWith("en") ? DEFAULT_VOICE.en : DEFAULT_VOICE.fr
}
