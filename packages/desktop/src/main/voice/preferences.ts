import { synthesisModels, type VoiceModelID } from "./models"

export type VoicePreferences = { language?: string; prompt?: string; voice?: VoiceModelID }

/** Longest vocabulary hint sent to the recognizer, in characters. */
export const PROMPT_LIMIT = 200

// Whisper expects a bare language code ("fr", not "fr-FR") and returns nonsense for one it does not
// know, so anything else is dropped instead of forwarded.
const LANGUAGE = /^[a-z]{2,3}$/

export function sanitizePreferences(input: {
  language?: string
  prompt?: string
  voice?: string
}): VoicePreferences {
  const language = input.language?.trim().toLowerCase()
  const prompt = input.prompt?.trim().slice(0, PROMPT_LIMIT) || undefined

  // A voice naming an unknown model, or a speech or detector model, is dropped: the caller decides
  // which voice to speak with, and a stale id falls back to the default one.
  const voice = synthesisModels().find((model) => model.id === input.voice)?.id

  return {
    language: language && LANGUAGE.test(language) ? language : undefined,
    prompt,
    voice,
  }
}
