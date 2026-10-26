import { expect, test } from "bun:test"
import { PROMPT_LIMIT, sanitizePreferences } from "./preferences"

test.each([
  { name: "keeps a lower-case code", input: { language: "fr" }, language: "fr" },
  { name: "lower-cases and trims the code", input: { language: " FR " }, language: "fr" },
  { name: "drops a regional code, which whisper does not parse", input: { language: "fr-FR" }, language: undefined },
  { name: "drops an unknown language", input: { language: "zzzz" }, language: undefined },
  { name: "drops an empty language", input: { language: "  " }, language: undefined },
])("$name", ({ input, language }) => {
  expect(sanitizePreferences(input).language).toBe(language as string | undefined)
})

test("trims the vocabulary and keeps it whole", () => {
  expect(sanitizePreferences({ prompt: "  Cairn, Sover, Traefik  " }).prompt).toBe("Cairn, Sover, Traefik")
})

test("cuts the vocabulary at the limit the recognizer accepts", () => {
  expect(sanitizePreferences({ prompt: "a".repeat(PROMPT_LIMIT + 40) }).prompt).toHaveLength(PROMPT_LIMIT)
})

test("an empty vocabulary is absent, not an empty string", () => {
  expect(sanitizePreferences({ prompt: "   " }).prompt).toBeUndefined()
})

test.each([
  { name: "keeps a synthesis voice", voice: "vits-piper-fr_FR-upmc-medium", expected: "vits-piper-fr_FR-upmc-medium" },
  { name: "drops an unknown voice", voice: "vits-piper-fr_FR-nope", expected: undefined },
  { name: "drops a speech model, which cannot speak", voice: "base-q5_1", expected: undefined },
  { name: "drops a detector, which cannot speak", voice: "silero-v6.2.0", expected: undefined },
])("$name", ({ voice, expected }) => {
  expect(sanitizePreferences({ voice }).voice).toBe(expected)
})
