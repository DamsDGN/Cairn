import { expect, test } from "bun:test"
import { cleanTranscription } from "./artifacts"

test.each([
  { name: "the Amara credit", text: "Sous-titres réalisés par la communauté d'Amara.org" },
  { name: "the Amara credit without its opening", text: "[Sous-titres par la communauté d'Amara.org]" },
  { name: "the English closing line", text: "Thank you for watching!" },
  { name: "a stage direction", text: "[Musique]" },
  { name: "a French thanks", text: "Merci d'avoir regardé." },
])("drops a transcript that is only $name", ({ text }) => {
  expect(cleanTranscription(text)).toBe("")
})

test.each([
  { name: "a real sentence", text: "J'ai déployé Cairn chez Sover à Brest." },
  {
    name: "a sentence that ends with thanks",
    text: "J'ai regardé la vidéo jusqu'au bout, merci d'avoir regardé.",
  },
  { name: "a sentence about music", text: "La musique de fond était trop forte." },
  { name: "text that mentions the site", text: "J'ai lu le tutoriel sur Amara.org hier." },
])("keeps $name", ({ name, text }) => {
  expect(cleanTranscription(text)).toBe(text)
})

test.each([
  { name: "an empty transcript", text: "" },
  { name: "a blank transcript", text: "   \n " },
])("returns nothing for $name", ({ text }) => {
  expect(cleanTranscription(text)).toBe("")
})

test("keeps the transcript without its surrounding spaces", () => {
  expect(cleanTranscription("  bonjour  ")).toBe("bonjour")
})
