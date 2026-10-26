// Turning a streamed markdown answer into sentences a speech engine can read without saying the
// syntax out loud.

const SENTENCE_END = /[.!?…]$/

/** Splits at a sentence boundary or a hard line break, keeping the unfinished tail. */
export function splitSentences(text: string) {
  const parts = text.split(/(?<=[.!?…])\s+|\n+/)
  const last = (parts.pop() ?? "").trim()
  const sentences = parts.map((part) => part.trim()).filter(Boolean)

  if (SENTENCE_END.test(last)) {
    if (last) sentences.push(last)

    return { sentences, rest: "" }
  }

  return { sentences, rest: last }
}

/** A piece of the answer to speak: prose, or a code block the voice only announces. */
export type SpeechPiece = { type: "text"; text: string } | { type: "code"; language?: string }

const FENCE = /```([^\n`]*)\n?([\s\S]*?)```/g

// The info string of a fence is the language the code is written in. It is read aloud, so the
// usual short aliases are expanded into the name people recognise.
const CODE_LANGUAGES = new Map([
  ["ts", "TypeScript"],
  ["tsx", "TypeScript"],
  ["typescript", "TypeScript"],
  ["js", "JavaScript"],
  ["jsx", "JavaScript"],
  ["javascript", "JavaScript"],
  ["py", "Python"],
  ["python", "Python"],
  ["sh", "shell"],
  ["bash", "shell"],
  ["zsh", "shell"],
  ["shell", "shell"],
  ["rs", "Rust"],
  ["rust", "Rust"],
  ["go", "Go"],
  ["yml", "YAML"],
  ["yaml", "YAML"],
  ["md", "Markdown"],
  ["html", "HTML"],
  ["css", "CSS"],
  ["sql", "SQL"],
  ["json", "JSON"],
])

export function codeLanguageName(info: string) {
  const token = info.trim().split(/\s+/)[0]?.toLowerCase()

  if (!token) return undefined

  return CODE_LANGUAGES.get(token) ?? token
}

// Code is not read out loud: every fenced block becomes one short announcement, and an unfinished
// fence stays in `rest` until its closing marker arrives, so the voice never speaks source code.
export function splitSpeech(text: string, final = false) {
  const segments: SpeechPiece[] = []
  let cursor = 0
  let rest = ""

  FENCE.lastIndex = 0

  for (let match = FENCE.exec(text); match; match = FENCE.exec(text)) {
    // A sentence right before a block still ends there, even without punctuation.
    const prose = text.slice(cursor, match.index)
    const split = splitSentences(prose)

    segments.push(...split.sentences.map((sentence): SpeechPiece => ({ type: "text", text: sentence })))

    if (split.rest) segments.push({ type: "text", text: split.rest })

    segments.push({ type: "code", language: codeLanguageName(match[1] ?? "") })
    cursor = match.index + match[0].length
  }

  const tail = text.slice(cursor)
  const open = tail.indexOf("```")

  if (open >= 0 && !final) {
    const split = splitSentences(tail.slice(0, open))

    segments.push(...split.sentences.map((sentence): SpeechPiece => ({ type: "text", text: sentence })))

    if (split.rest) segments.push({ type: "text", text: split.rest })

    rest = tail.slice(open)

    return { segments, rest }
  }

  // The answer ended with an unterminated fence: announce it like any other block.
  if (open >= 0) {
    const split = splitSentences(tail.slice(0, open))

    segments.push(...split.sentences.map((sentence): SpeechPiece => ({ type: "text", text: sentence })))

    if (split.rest) segments.push({ type: "text", text: split.rest })

    const info = tail.slice(open + 3).split("\n")[0] ?? ""

    segments.push({ type: "code", language: codeLanguageName(info) })

    return { segments, rest: "" }
  }

  const split = splitSentences(tail)

  segments.push(...split.sentences.map((sentence): SpeechPiece => ({ type: "text", text: sentence })))

  return { segments, rest: split.rest }
}

const INLINE_CODE = /`([^`]*)`/g

const LINK = /\[([^\]]*)\]\([^)]*\)/g

const URL = /https?:\/\/\S+/g

const MARKDOWN = /[*_#>~|]/g

/** What the speaker should say for a markdown fragment. */
export function speakable(text: string) {
  return text
    .replace(INLINE_CODE, "$1")
    .replace(LINK, "$1")
    .replace(URL, " ")
    .replace(MARKDOWN, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}
