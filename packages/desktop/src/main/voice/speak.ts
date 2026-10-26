import { createRequire } from "node:module"
import { availableParallelism } from "node:os"
import path from "node:path"

import { modelPath, voiceModel, type VoiceModelID } from "./models"

type GeneratedAudio = { samples: Float32Array; sampleRate: number }

type TtsEngine = {
  generate(input: {
    text: string
    sid: number
    speed: number
    enableExternalBuffer: boolean
  }): GeneratedAudio
}

type TtsConfig = {
  model: {
    vits: { model: string; tokens: string; dataDir?: string }
    numThreads: number
    provider: string
  }
  maxNumSentences: number
}

type Sherpa = {
  OfflineTts: new (config: TtsConfig) => TtsEngine
}

const nativeRequire = createRequire(import.meta.url)

let loaded: Sherpa | undefined

const engines = new Map<string, Promise<TtsEngine>>()

// Synthesis runs in the main process because the engine is native. One call at a time: the renderer
// speaks sentence by sentence and the engine keeps decoder state between calls.
let synthesis: Promise<unknown> = Promise.resolve()

function serialized<T>(run: () => Promise<T>): Promise<T> {
  const next = synthesis.then(run, run)

  synthesis = next.catch(() => undefined)

  return next
}

function sherpa(): Sherpa {
  // SAFETY: the package is pinned in package.json, and only its documented constructor and generate
  // method are used here.
  loaded ??= nativeRequire("sherpa-onnx-node") as Sherpa

  return loaded
}

function loadEngine(directory: string, onnx: string, dataDir: string | undefined): Promise<TtsEngine> {
  const cached = engines.get(directory)

  if (cached) return cached

  const created = Promise.resolve().then(() => {
    const vits: { model: string; tokens: string; dataDir?: string } = {
      model: path.join(directory, onnx),
      tokens: path.join(directory, "tokens.txt"),
    }

    if (dataDir) vits.dataDir = dataDir

    return new (sherpa().OfflineTts)({
      model: {
        vits,
        numThreads: Math.max(1, Math.min(4, availableParallelism() - 1)),
        provider: "cpu",
      },
      maxNumSentences: 1,
    })
  })

  engines.set(directory, created)

  return created
}

// The sentence is phonemized by the espeak data shipped in the voice archive, so the caller only
// sends text. Samples come back as signed 16-bit mono PCM, the format the renderer plays directly.
export async function synthesize(input: { dataDirectory: string; id: VoiceModelID; text: string }) {
  const model = voiceModel(input.id)

  if (!model?.archive) throw new Error(`Unknown synthesis voice: ${input.id}`)

  const directory = modelPath(input.dataDirectory, model)

  const engine = await loadEngine(
    directory,
    model.archive.onnx,
    model.archive.dataDir ? path.join(directory, "espeak-ng-data") : undefined,
  )

  return serialized(async () => {
    // Electron's V8 memory cage rejects external ArrayBuffers, and sherpa-onnx creates one for the
    // samples by default: without this flag every synthesis throws "External buffers are not
    // allowed" in the main process. The copy costs less than a millisecond per sentence.
    const audio = engine.generate({
      text: input.text.trim(),
      sid: model.speaker ?? 0,
      speed: 1,
      enableExternalBuffer: false,
    })

    return { audio: pcm16(audio.samples), sampleRate: audio.sampleRate }
  })
}

function pcm16(samples: Float32Array) {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)

  for (const [index, sample] of samples.entries()) {
    const value = Math.max(-1, Math.min(1, sample))

    view.setInt16(index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
  }

  return new Uint8Array(buffer)
}
