import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"

import { isInstalled, modelPath, partialPath, voiceModel, type VoiceModelID } from "./models"

export type DownloadState = {
  status: "idle" | "downloading" | "installed" | "failed"
  received: number
  total: number
}

const idle: DownloadState = { status: "idle", received: 0, total: 0 }

// One transfer per model, tracked so the renderer can poll its progress instead of holding a call
// open for the whole download.
export function createVoiceDownloader(dataDirectory: string) {
  const states = new Map<VoiceModelID, DownloadState>()
  const running = new Map<VoiceModelID, Promise<DownloadState>>()

  const read = (id: VoiceModelID): DownloadState => {
    const model = voiceModel(id)

    if (!model) return idle

    const target = modelPath(dataDirectory, model)
    if (isInstalled(target, model)) return { status: "installed", received: model.size, total: model.size }

    return states.get(id) ?? idle
  }

  const start = (id: VoiceModelID): Promise<DownloadState> => {
    const pending = running.get(id)

    if (pending) return pending

    const model = voiceModel(id)

    if (!model) return Promise.resolve(idle)

    const target = modelPath(dataDirectory, model)
    if (isInstalled(target, model)) return Promise.resolve(read(id))

    const task = downloadFile({
      url: model.url,
      target,
      size: model.size,
      sha256: model.sha256,
      report: (state) => states.set(id, state),
    })
      .then((state) => {
        states.set(id, state)

        return state
      })
      .finally(() => running.delete(id))

    running.set(id, task)

    return task
  }

  const remove = async (id: VoiceModelID): Promise<boolean> => {
    const model = voiceModel(id)

    if (!model) return false

    const target = modelPath(dataDirectory, model)
    await rm(target, { force: true })
    await rm(partialPath(target), { force: true })
    states.delete(id)

    return true
  }

  return { read, start, remove }
}

export type VoiceDownloader = ReturnType<typeof createVoiceDownloader>

// A transfer lands on a `.part` file and is renamed only once the byte count matches the published
// size, so an interrupted download never looks installed.
export async function downloadFile(input: {
  url: string
  target: string
  size: number
  sha256: string
  report: (state: DownloadState) => void
}): Promise<DownloadState> {
  const partial = partialPath(input.target)
  const failed: DownloadState = { status: "failed", received: 0, total: input.size }

  await mkdir(path.dirname(input.target), { recursive: true })
  await rm(partial, { force: true })

  const response = await fetch(input.url)

  if (!response.ok || !response.body) {
    input.report(failed)

    return failed
  }

  const sink = createWriteStream(partial)
  const hash = createHash("sha256")
  let received = 0

  try {
    for await (const chunk of response.body) {
      hash.update(chunk)
      received += chunk.byteLength
      input.report({ status: "downloading", received, total: input.size })
      if (!sink.write(chunk)) await new Promise<void>((resolve) => sink.once("drain", () => resolve()))
    }
  } catch {
    sink.destroy()
    await rm(partial, { force: true })
    input.report(failed)

    return failed
  }

  await new Promise<void>((resolve, reject) => {
    sink.end(() => resolve())
    sink.once("error", reject)
  })

  if (received !== input.size) {
    await rm(partial, { force: true })
    input.report(failed)

    return failed
  }

  // The size proves the transfer completed; the digest proves it is the file that was published.
  if (hash.digest("hex") !== input.sha256) {
    await rm(partial, { force: true })
    input.report(failed)

    return failed
  }

  await rename(partial, input.target)

  const done: DownloadState = { status: "installed", received: input.size, total: input.size }
  input.report(done)

  return done
}
