import { expect, test } from "bun:test"
import { DESKTOP_NATIVE_LOCALES } from "@/runtime/i18n/desktop-native"
import { dictationLanguage, dictationLanguages } from "./languages"

test.each([
  { name: "a regional French locale", locale: "fr-FR", language: "fr" },
  { name: "an interface locale without a region", locale: "fr", language: "fr" },
  { name: "an English locale", locale: "en-GB", language: "en" },
  { name: "traditional Chinese, which whisper does not distinguish", locale: "zht", language: "zh" },
  { name: "an uppercase code", locale: "DE-at", language: "de" },
  { name: "a language whisper does not know", locale: "dv", language: "en" },
  { name: "an empty locale", locale: "", language: "en" },
])("$name", ({ locale, language }) => {
  expect(dictationLanguage(locale)).toBe(language)
})

test("every interface language maps to a whisper code, English included", () => {
  const unsupported = DESKTOP_NATIVE_LOCALES.filter((locale) => dictationLanguage(locale) === "en" && locale !== "en")

  expect(unsupported.sort()).toEqual(["dv", "dz"])
})

test("the offered languages are unique and contain the interface languages", () => {
  const offered = dictationLanguages(DESKTOP_NATIVE_LOCALES)

  expect(new Set(offered).size).toBe(offered.length)
  expect(offered).toContain("fr")
  expect(offered).toContain("en")
  expect(offered).toContain("zh")
})
