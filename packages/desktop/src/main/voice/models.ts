import { existsSync, statSync } from "node:fs"
import path from "node:path"

export type VoiceModelID = "base-q5_1" | "small-q5_1" | "small"

export type VoiceModel = {
  id: VoiceModelID
  file: string
  /** Exact byte length of the published file, so a truncated download is detected. */
  size: number
  url: string
}

// Whisper checkpoints published by the whisper.cpp project. The quantized small model is the
// default: it transcribes French well on a CPU while staying under 200 MB, where the full small
// model is 465 MB for a small accuracy gain.
export const VOICE_MODELS: readonly VoiceModel[] = [
  {
    id: "base-q5_1",
    file: "ggml-base-q5_1.bin",
    size: 59_707_625,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
  },
  {
    id: "small-q5_1",
    file: "ggml-small-q5_1.bin",
    size: 190_085_487,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
  },
  {
    id: "small",
    file: "ggml-small.bin",
    size: 487_601_967,
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
]

export const DEFAULT_VOICE_MODEL: VoiceModelID = "small-q5_1"

export function voiceModel(id: string): VoiceModel | undefined {
  return VOICE_MODELS.find((model) => model.id === id)
}

export function modelsDirectory(dataDirectory: string): string {
  return path.join(dataDirectory, "voice", "models")
}

export function modelPath(dataDirectory: string, model: VoiceModel): string {
  return path.join(modelsDirectory(dataDirectory), model.file)
}

// A partial download keeps the `.part` suffix until it completes, so an interrupted transfer never
// looks installed.
export function partialPath(target: string): string {
  return `${target}.part`
}

export function isInstalled(target: string, model: VoiceModel): boolean {
  if (!existsSync(target)) return false

  return statSync(target).size === model.size
}
