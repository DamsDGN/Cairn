import { getStore } from "../storage/store"
import { VOICE_LANGUAGE_KEY, VOICE_MODEL_KEY, VOICE_PROMPT_KEY } from "../storage/keys"
import { sanitizePreferences, type VoicePreferences } from "./preferences"

export function readVoicePreferences(): VoicePreferences {
  const store = getStore()
  const language = store.get(VOICE_LANGUAGE_KEY)
  const prompt = store.get(VOICE_PROMPT_KEY)
  const voice = store.get(VOICE_MODEL_KEY)

  return sanitizePreferences({
    language: typeof language === "string" ? language : undefined,
    prompt: typeof prompt === "string" ? prompt : undefined,
    voice: typeof voice === "string" ? voice : undefined,
  })
}

export function writeVoicePreferences(input: {
  language?: string
  prompt?: string
  voice?: string
}): VoicePreferences {
  const preferences = sanitizePreferences(input)
  const store = getStore()

  store.delete(VOICE_LANGUAGE_KEY)
  store.delete(VOICE_PROMPT_KEY)
  store.delete(VOICE_MODEL_KEY)

  if (preferences.language) store.set(VOICE_LANGUAGE_KEY, preferences.language)

  if (preferences.prompt) store.set(VOICE_PROMPT_KEY, preferences.prompt)

  if (preferences.voice) store.set(VOICE_MODEL_KEY, preferences.voice)

  return preferences
}
