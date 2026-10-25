import { app } from "electron"
import { availableParallelism } from "node:os"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { acceleration, type Acceleration } from "./cpu"
import { modelPath, voiceModel, type VoiceModelID } from "./models"

type Transcription = { result: string; isAborted: boolean }

type WhisperContext = {
  transcribeData(
    audio: ArrayBuffer,
    options: { language?: string; maxThreads?: number; onProgress?: (progress: number) => void },
  ): { stop: () => void; promise: Promise<Transcription> }
  release(): Promise<void>
}

type Whisper = {
  initWhisper(options: { filePath: string; useGpu?: boolean; useCoreML?: boolean }): Promise<WhisperContext>
}

// Release builds carry a second Linux x64 addon compiled for AVX2 next to the portable one from the
// npm package. It is loaded by path: the npm binding resolves its native library by package name,
// which only works from inside the dependency tree.
type NativeModule = {
  WhisperContext: new (options: { filePath: string; useGpu?: boolean; useCoreML?: boolean }) =>
    | Promise<WhisperContext>
    | WhisperContext
}

const require = createRequire(import.meta.url)

const AVX2_ADDON = path.join("whisper-avx2", "index.node")

let loaded: Promise<Whisper> | undefined

const contexts = new Map<string, Promise<WhisperContext>>()

async function whisper(): Promise<Whisper> {
  loaded ??= loadWhisper()

  return loaded
}

async function loadWhisper(): Promise<Whisper> {
  const addon = avx2Addon()

  if (!addon) return import("@fugood/whisper.node" as string).then((module) => module as unknown as Whisper)

  // SAFETY: the optimized addon is built from the same source as the npm binding, so it exports the
  // same WhisperContext class; an incompatible file fails when the context is constructed.
  const native = require(addon) as NativeModule

  return { initWhisper: async (options) => new native.WhisperContext(options) }
}

// Transcription runs in the main process because the whisper binding is native. The renderer sends
// 16 kHz mono signed 16-bit PCM, which is the format the recognizer expects.
export async function transcribe(input: {
  dataDirectory: string
  id: VoiceModelID
  audio: ArrayBuffer
  language?: string
}): Promise<string> {
  const model = voiceModel(input.id)

  if (!model) throw new Error(`Unknown voice model: ${input.id}`)

  const context = await loadContext(modelPath(input.dataDirectory, model))

  const task = context.transcribeData(input.audio, {
    language: input.language,
    maxThreads: threads(),
  })

  const result = await task.promise

  return result.result.trim()
}

export async function release(): Promise<void> {
  const pending = [...contexts.values()]
  contexts.clear()

  for (const context of pending) {
    await context.then((value) => value.release()).catch(() => undefined)
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

function threads(): number {
  return Math.max(1, Math.min(8, availableParallelism() - 1))
}
