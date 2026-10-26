import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"

import {
  archivePath,
  isInstalled,
  modelPath,
  modelsDirectory,
  partialPath,
  voiceModel,
  type VoiceModel,
  type VoiceModelID,
} from "./models"

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

  const installed = (model: VoiceModel): DownloadState => ({
    status: "installed",
    received: model.size,
    total: model.size,
  })

  const read = (id: VoiceModelID): DownloadState => {
    const model = voiceModel(id)

    if (!model) return idle

    if (isInstalled(modelPath(dataDirectory, model), model)) return installed(model)

    return states.get(id) ?? idle
  }

  const install = async (id: VoiceModelID, model: VoiceModel): Promise<DownloadState> => {
    const target = modelPath(dataDirectory, model)
    const report = (state: DownloadState) => states.set(id, state)

    if (!model.archive) {
      return downloadFile({ url: model.url, target, size: model.size, sha256: model.sha256, report })
    }

    const source = archivePath(dataDirectory, model)
    const downloaded = await downloadFile({
      url: model.url,
      target: source,
      size: model.size,
      sha256: model.sha256,
      report,
    })

    if (downloaded.status !== "installed") return downloaded

    report({ status: "downloading", received: model.size, total: model.size })

    try {
      await extract(source, modelsDirectory(dataDirectory))
      await rm(source, { force: true })
    } catch {
      report({ status: "failed", received: 0, total: model.size })

      return { status: "failed", received: 0, total: model.size }
    }

    const done = isInstalled(target, model)
      ? installed(model)
      : { status: "failed" as const, received: 0, total: model.size }

    report(done)

    return done
  }

  const start = (id: VoiceModelID): Promise<DownloadState> => {
    const pending = running.get(id)

    if (pending) return pending

    const model = voiceModel(id)

    if (!model) return Promise.resolve(idle)

    if (isInstalled(modelPath(dataDirectory, model), model)) return Promise.resolve(read(id))

    const task = install(id, model)
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

    await rm(target, { force: true, recursive: !!model.archive })

    if (model.archive) {
      const source = archivePath(dataDirectory, model)

      await rm(source, { force: true })
      await rm(partialPath(source), { force: true })
    }

    states.delete(id)

    return true
  }

  return { read, start, remove }
}

export type VoiceDownloader = ReturnType<typeof createVoiceDownloader>

// The voice archives ship as tar.bz2. Every supported desktop system carries a tar binary (GNU tar,
// bsdtar on macOS, and bsdtar in Windows 10 and later), which keeps a bzip2 decoder out of the app.
async function extract(source: string, directory: string) {
  await mkdir(directory, { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xjf", source, "-C", directory], { stdio: "ignore", windowsHide: true })

    child.once("error", reject)
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`tar exited with code ${code}`))))
  })
}

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
