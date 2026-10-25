// The languages whisper.cpp knows, as bare codes. The interface ships more locales than that, and
// several codes are regional variants of the same spoken language.
const WHISPER_LANGUAGES: ReadonlySet<string> = new Set([
  "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs", "ca", "cs", "cy", "da",
  "de", "el", "en", "es", "et", "eu", "fa", "fi", "fo", "fr", "gl", "gu", "ha", "he", "hi", "hr",
  "ht", "hu", "hy", "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb", "ln",
  "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl", "nn", "no",
  "oc", "pa", "pl", "ps", "pt", "ro", "ru", "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr",
  "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi", "yi",
  "yo", "zh",
])

// The interface distinguishes traditional Chinese, whisper does not.
const ALIASES: Readonly<Record<string, string>> = { zht: "zh" }

export function dictationLanguage(locale: string): string {
  const base = locale.split("-")[0]?.toLowerCase() ?? ""
  const code = ALIASES[base] ?? base

  return WHISPER_LANGUAGES.has(code) ? code : "en"
}

/** Interface locales that can be dictated in, without duplicates. */
export function dictationLanguages(locales: readonly string[]): string[] {
  return [...new Set(locales.map(dictationLanguage))].filter((code) => WHISPER_LANGUAGES.has(code))
}
