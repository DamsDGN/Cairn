export type VoicePreferences = { language?: string; prompt?: string }

/** Longest vocabulary hint sent to the recognizer, in characters. */
export const PROMPT_LIMIT = 200

// Whisper expects a bare language code ("fr", not "fr-FR") and returns nonsense for one it does not
// know, so anything else is dropped instead of forwarded.
const LANGUAGE = /^[a-z]{2,3}$/

export function sanitizePreferences(input: { language?: string; prompt?: string }): VoicePreferences {
  const language = input.language?.trim().toLowerCase()
  const prompt = input.prompt?.trim().slice(0, PROMPT_LIMIT) || undefined

  return {
    language: language && LANGUAGE.test(language) ? language : undefined,
    prompt,
  }
}
