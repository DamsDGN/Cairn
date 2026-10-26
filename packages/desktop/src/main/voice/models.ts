import { existsSync, statSync } from "node:fs"
import path from "node:path"

export type VoiceModelID = "base-q5_1" | "small-q5_1" | "small" | "silero-v6.2.0" | "vits-piper-fr_FR-siwis-medium"

export type VoiceModel = {
  id: VoiceModelID
  file: string
  /** Exact byte length of the published file, so a truncated download is detected. */
  size: number
  /** SHA-256 of the published file, checked before the download is renamed into place. */
  sha256: string
  url: string
  /** Speech models produce text, detectors find where speech is, synthesis speaks it back. */
  kind: "speech" | "detector" | "synthesis"
  /** A synthesis voice arrives as one archive that is extracted into its own folder. */
  archive?: {
    directory: string
    onnx: string
    entries: readonly string[]
  }
}

// Whisper checkpoints published by the whisper.cpp project, the Silero voice detector from the same
// project, and the Piper voices from the sherpa-onnx release, which bundles the tokens the engine
// needs next to the ONNX file.
export const VOICE_MODELS: readonly VoiceModel[] = [
  {
    id: "base-q5_1",
    file: "ggml-base-q5_1.bin",
    size: 59_707_625,
    sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
    kind: "speech",
  },
  {
    id: "small-q5_1",
    file: "ggml-small-q5_1.bin",
    size: 190_085_487,
    sha256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
    kind: "speech",
  },
  {
    id: "small",
    file: "ggml-small.bin",
    size: 487_601_967,
    sha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    kind: "speech",
  },
  {
    id: "silero-v6.2.0",
    file: "ggml-silero-v6.2.0.bin",
    size: 885_098,
    sha256: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
    url: "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v6.2.0.bin",
    kind: "detector",
  },
  {
    id: "vits-piper-fr_FR-siwis-medium",
    file: "vits-piper-fr_FR-siwis-medium.tar.bz2",
    size: 67_207_459,
    sha256: "375909aa30842b3a4efa10b1beb1d761af792960ae6873b4d53889f96c66195b",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-fr_FR-siwis-medium.tar.bz2",
    kind: "synthesis",
    archive: {
      directory: "vits-piper-fr_FR-siwis-medium",
      onnx: "fr_FR-siwis-medium.onnx",
      entries: ["fr_FR-siwis-medium.onnx", "tokens.txt"],
    },
  },
]

export const DEFAULT_VOICE_MODEL: VoiceModelID = "base-q5_1"

export const DETECTOR_VOICE_MODEL: VoiceModelID = "silero-v6.2.0"

export const SYNTHESIS_VOICE_MODEL: VoiceModelID = "vits-piper-fr_FR-siwis-medium"

// The small models stay in the catalog but are not offered: they were slower than base and
// hallucinated subtitles on the reference machine, and the optimized build has not been measured
// against them yet. Remove the entry from this list once that measurement exists.
const HIDDEN_VOICE_MODELS: readonly VoiceModelID[] = ["small-q5_1", "small"]

export function voiceModel(id: string): VoiceModel | undefined {
  return VOICE_MODELS.find((model) => model.id === id)
}

export function visibleVoiceModels(): readonly VoiceModel[] {
  return VOICE_MODELS.filter((model) => !HIDDEN_VOICE_MODELS.includes(model.id))
}

export function speechModels(): readonly VoiceModel[] {
  return visibleVoiceModels().filter((model) => model.kind === "speech")
}


export function modelsDirectory(dataDirectory: string): string {
  return path.join(dataDirectory, "voice", "models")
}

/** Where the model lives once installed: a file, or a folder for an extracted voice. */
export function modelPath(dataDirectory: string, model: VoiceModel): string {
  return path.join(modelsDirectory(dataDirectory), model.archive?.directory ?? model.file)
}

/** Where the downloaded archive is written before extraction. */
export function archivePath(dataDirectory: string, model: VoiceModel): string {
  return path.join(modelsDirectory(dataDirectory), model.file)
}

// A partial download keeps the `.part` suffix until it completes, so an interrupted transfer never
// looks installed.
export function partialPath(target: string): string {
  return `${target}.part`
}

export function isInstalled(target: string, model: VoiceModel): boolean {
  if (model.archive) {
    return model.archive.entries.every((entry) => existsSync(path.join(target, entry)))
  }

  if (!existsSync(target)) return false

  return statSync(target).size === model.size
}
