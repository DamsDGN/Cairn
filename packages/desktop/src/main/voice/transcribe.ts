import { app } from "electron"
import { existsSync, readFileSync } from "node:fs"
import { availableParallelism } from "node:os"
import { createRequire } from "node:module"
import path from "node:path"

import { cleanTranscription } from "./artifacts"
import { acceleration, voiceThreads, type Acceleration } from "./cpu"
import {
  DETECTOR_VOICE_MODEL,
  isInstalled,
  modelPath,
  speechModels,
  voiceModel,
  type VoiceModelID,
} from "./models"

type Transcription = { result: string; isAborted: boolean }

type WhisperContext = {
  transcribeData(
    audio: ArrayBuffer,
    options: {
      language?: string
      translate?: boolean
      maxThreads?: number
      nProcessors?: number
      prompt?: string
    },
  ): { stop: () => void; promise: Promise<Transcription> }
  release(): Promise<void>
}

type DetectorContext = {
  detectSpeechData(audio: ArrayBuffer): Promise<Array<{ t0: number; t1: number }>>
  release(): Promise<void>
}

type ContextOptions = { filePath: string; useGpu?: boolean; useCoreML?: boolean }

type Whisper = {
  initWhisper(options: ContextOptions): Promise<WhisperContext>
  initWhisperVad?(options: ContextOptions): Promise<DetectorContext>
}

// Release builds carry a second Linux x64 addon compiled for AVX2 next to the portable one from the
// npm package. It is loaded by path: the npm binding resolves its native library by package name,
// which only works from inside the dependency tree.
type NativeModule = {
  WhisperContext: new (options: ContextOptions) => Promise<WhisperContext> | WhisperContext
  WhisperVadContext?: new (options: ContextOptions) => Promise<DetectorContext> | DetectorContext
}

const SAMPLE_RATE = 16_000

// Voice activity segments come back in hundredths of a second.
const SEGMENT_UNIT_MS = 10

const nativeRequire = createRequire(import.meta.url)

const AVX2_ADDON = path.join("whisper-avx2", "index.node")

let loaded: Promise<Whisper> | undefined

const contexts = new Map<string, Promise<WhisperContext>>()
const detectors = new Map<string, Promise<DetectorContext>>()

// One task at a time on a whisper context: a second call would corrupt its decoder state. Dictation
// sends sentences as they end, so the callers queue instead of failing.
let transcription: Promise<unknown> = Promise.resolve()

function serialized<T>(run: () => Promise<T>): Promise<T> {
  const next = transcription.then(run, run)

  transcription = next.catch(() => undefined)

  return next
}

async function whisper(): Promise<Whisper> {
  loaded ??= loadWhisper()

  return loaded
}

async function loadWhisper(): Promise<Whisper> {
  const addon = avx2Addon()
  const portable = () => import("@fugood/whisper.node" as string).then((module) => module as unknown as Whisper)

  if (!addon) return portable()

  try {
    // SAFETY: the optimized addon is built from the same source as the npm binding, so it exports
    // the same context classes; an incompatible file fails when the context is constructed.
    const native = nativeRequire(addon) as NativeModule

    return {
      initWhisper: async (options) => new native.WhisperContext(options),
      initWhisperVad: native.WhisperVadContext
        ? async (options) => new native.WhisperVadContext!(options)
        : undefined,
    }
  } catch {
    // A binary built against a newer glibc than the machine has cannot be loaded, and dictation must
    // keep working, only slower.
    return portable()
  }
}

// Transcription runs in the main process because the whisper binding is native. The renderer sends
// 16 kHz mono signed 16-bit PCM, which is the format the recognizer expects.
export async function transcribe(input: {
  dataDirectory: string
  id: VoiceModelID
  audio: ArrayBuffer
  language: string
  prompt?: string
}): Promise<string> {
  const model = voiceModel(input.id)

  if (!model) throw new Error(`Unknown voice model: ${input.id}`)

  const audio = await speechOnly(input.dataDirectory, input.audio)

  if (!audio) return ""

  const context = await loadContext(modelPath(input.dataDirectory, model))

  return serialized(async () => {
    const task = context.transcribeData(audio, {
      language: input.language,
      translate: false,
      prompt: input.prompt,
      maxThreads: voiceThreads(availableParallelism()),
      nProcessors: 1,
    })

    const result = await task.promise

    return cleanTranscription(result.result)
  })
}

// Loads the default model in the background once the window is up, so the first dictation does not
// pay for the model load. A machine without a model stays silent.
export function preload(dataDirectory: string): void {
  const installed = speechModels().find((model) => isInstalled(modelPath(dataDirectory, model), model))

  if (!installed) return

  void loadContext(modelPath(dataDirectory, installed)).catch(() => undefined)
}

export async function release(): Promise<void> {
  const pending = [...contexts.values()]
  const pendingDetectors = [...detectors.values()]
  contexts.clear()
  detectors.clear()

  for (const context of pending) {
    await context.then((value) => value.release()).catch(() => undefined)
  }

  for (const detector of pendingDetectors) {
    await detector.then((value) => value.release()).catch(() => undefined)
  }
}

function loadContext(filePath: string): Promise<WhisperContext> {
  const cached = contexts.get(filePath)

  if (cached) return cached

  const created = whisper().then((module) =>
    module.initWhisper({ filePath, useGpu: false, useCoreML: process.platform === "darwin" }),
  )

  contexts.set(filePath, created)

  return created
}

function loadDetector(filePath: string): Promise<DetectorContext> | undefined {
  const cached = detectors.get(filePath)

  if (cached) return cached

  const created = whisper().then((module) => {
    if (!module.initWhisperVad) throw new Error("This build cannot detect speech")

    return module.initWhisperVad({ filePath, useGpu: false })
  })

  detectors.set(filePath, created)

  return created
}

// Silence and noise are where whisper invents text, so the detector decides whether there is
// anything to transcribe and trims the lead-in and trail-out. Without the detector the whole
// recording is transcribed: the filter on the result still drops the usual inventions.
async function speechOnly(dataDirectory: string, audio: ArrayBuffer): Promise<ArrayBuffer | undefined> {
  const detector = voiceModel(DETECTOR_VOICE_MODEL)

  if (!detector) return audio

  const file = modelPath(dataDirectory, detector)

  if (!isInstalled(file, detector)) return audio

  const context = await loadDetector(file)

  if (!context) return audio

  const segments = await context.detectSpeechData(audio)

  if (!segments.length) return undefined

  const first = segments.at(0)!
  const last = segments.at(-1)!

  return audio.slice(sampleOffset(first.t0), sampleOffset(last.t1))
}

function sampleOffset(hundredths: number) {
  return Math.max(0, Math.round((hundredths * SEGMENT_UNIT_MS * SAMPLE_RATE) / 1000) * 2)
}

// The settings page reports which kernel runs, and warns when the machine falls back to the portable
// build: same transcription quality, a fraction of the speed.
export function accelerationLevel(): Acceleration {
  return avx2Addon() ? "avx2" : "compatible"
}

function avx2Addon(): string | undefined {
  if (process.platform !== "linux" || process.arch !== "x64") return undefined

  const cpuinfo = existsSync("/proc/cpuinfo") ? readFileSync("/proc/cpuinfo", "utf8") : ""

  if (acceleration(process.platform, process.arch, cpuinfo) !== "avx2") return undefined

  const addon = path.join(process.resourcesPath, AVX2_ADDON)
  const development = path.join(app.getAppPath(), "resources", AVX2_ADDON)

  if (app.isPackaged && existsSync(addon)) return addon

  return existsSync(development) ? development : undefined
}
