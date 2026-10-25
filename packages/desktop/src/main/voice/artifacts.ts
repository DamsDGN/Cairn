// Whisper was trained on subtitled videos, so audio that ends in silence or in noise can come back
// as closing credits or as a stage direction. Only a transcript that is entirely one of those lines
// is dropped: the same words inside a real sentence are kept.
const ARTIFACTS: ReadonlySet<string> = new Set([
  "sous titres realises par la communaute d amara org",
  "sous titres realises par la communaute damara org",
  "sous titres par la communaute d amara org",
  "sous titres par la communaute damara org",
  "sous titres realises par amara org",
  "sous titres par amara org",
  "merci d avoir regarde",
  "merci d avoir regarde cette video",
  "merci davoir regarde",
  "thanks for watching",
  "thank you for watching",
  "musique",
  "music",
  "applaudissements",
  "applause",
  "rires",
  "laughter",
])

export function cleanTranscription(text: string): string {
  const trimmed = text.trim()

  return ARTIFACTS.has(normalize(trimmed)) ? "" : trimmed
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
}
