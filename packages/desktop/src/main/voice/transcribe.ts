import { availableParallelism } from "node:os"

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

let loaded: Promise<Whisper> | undefined
const contexts = new Map<string, Promise<WhisperContext>>()

async function whisper(): Promise<Whisper> {
  loaded ??= import("@fugood/whisper.node" as string).then((module) => module as unknown as Whisper)

  return loaded
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

function threads(): number {
  return Math.max(1, Math.min(8, availableParallelism() - 1))
}
