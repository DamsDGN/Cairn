import { getStore } from "../storage/store"
import { VOICE_LANGUAGE_KEY, VOICE_PROMPT_KEY } from "../storage/keys"
import { sanitizePreferences, type VoicePreferences } from "./preferences"

export function readVoicePreferences(): VoicePreferences {
  const store = getStore()
  const language = store.get(VOICE_LANGUAGE_KEY)
  const prompt = store.get(VOICE_PROMPT_KEY)

  return sanitizePreferences({
    language: typeof language === "string" ? language : undefined,
    prompt: typeof prompt === "string" ? prompt : undefined,
  })
}

export function writeVoicePreferences(input: { language?: string; prompt?: string }): VoicePreferences {
  const preferences = sanitizePreferences(input)
  const store = getStore()

  store.delete(VOICE_LANGUAGE_KEY)
  store.delete(VOICE_PROMPT_KEY)

  if (preferences.language) store.set(VOICE_LANGUAGE_KEY, preferences.language)
  if (preferences.prompt) store.set(VOICE_PROMPT_KEY, preferences.prompt)

  return preferences
}
