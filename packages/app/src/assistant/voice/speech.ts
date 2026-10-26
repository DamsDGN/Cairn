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

const CODE_BLOCK = /```[\s\S]*?```/g

const INLINE_CODE = /`([^`]*)`/g

const LINK = /\[([^\]]*)\]\([^)]*\)/g

const URL = /https?:\/\/\S+/g

const MARKDOWN = /[*_#>~|]/g

/** What the speaker should say for a markdown fragment. */
export function speakable(text: string) {
  return text
    .replace(CODE_BLOCK, " ")
    .replace(INLINE_CODE, "$1")
    .replace(LINK, "$1")
    .replace(URL, " ")
    .replace(MARKDOWN, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
}
