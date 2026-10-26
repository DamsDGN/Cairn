import { expect, test } from "bun:test"
import { codeLanguageName, splitSpeech, speakable } from "./speech"

test("prose is split into sentences and the tail is kept", () => {
  expect(splitSpeech("Bonjour. Voici la suite")).toEqual({
    segments: [{ type: "text", text: "Bonjour." }],
    rest: "Voici la suite",
  })
})

test("a code block is announced instead of read", () => {
  const { segments } = splitSpeech("Voici le code.\n```ts\nconst a = 1\n```\nVoilà.")

  expect(segments).toEqual([
    { type: "text", text: "Voici le code." },
    { type: "code", language: "TypeScript" },
    { type: "text", text: "Voilà." },
  ])
})

test("a sentence right before a block ends even without punctuation", () => {
  const { segments } = splitSpeech("Regarde\n```bash\nls\n```")

  expect(segments).toEqual([
    { type: "text", text: "Regarde" },
    { type: "code", language: "shell" },
  ])
})

test("an unterminated fence is held back until its closing marker arrives", () => {
  const { segments, rest } = splitSpeech("Voici.\n```py\nprint(1)")

  expect(segments).toEqual([{ type: "text", text: "Voici." }])
  expect(rest).toBe("```py\nprint(1)")
})

test("the end of the answer announces an unterminated fence instead of reading it", () => {
  expect(splitSpeech("Voici.\n```py\nprint(1)", true)).toEqual({
    segments: [
      { type: "text", text: "Voici." },
      { type: "code", language: "Python" },
    ],
    rest: "",
  })
})

test("an unlabelled block is announced without a language", () => {
  expect(splitSpeech("```\nx\n```").segments).toEqual([{ type: "code", language: undefined }])
})

test("code languages are named as people say them", () => {
  expect(codeLanguageName("ts")).toBe("TypeScript")
  expect(codeLanguageName("bash title=x")).toBe("shell")
  expect(codeLanguageName("zig")).toBe("zig")
  expect(codeLanguageName("")).toBeUndefined()
})

test("speakable strips inline markdown but keeps the words", () => {
  expect(speakable("Voici `npm run dev` et **gras**.")).toBe("Voici npm run dev et gras.")
})
