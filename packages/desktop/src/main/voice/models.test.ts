import { expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { downloadFile, type DownloadState } from "./download"
import {
  DEFAULT_VOICE_MODEL,
  DETECTOR_VOICE_MODEL,
  VOICE_MODELS,
  isInstalled,
  modelPath,
  modelsDirectory,
  partialPath,
  visibleVoiceModels,
} from "./models"

const digest = (data: Uint8Array) => new Bun.CryptoHasher("sha256").update(data).digest("hex")

test("the catalog keeps unique ids, exact sizes and a digest", () => {
  const ids = new Set(VOICE_MODELS.map((model) => model.id))

  expect(ids.size).toBe(VOICE_MODELS.length)
  expect(
    VOICE_MODELS.every((model) => model.size > 0 && model.file.endsWith(model.archive ? ".tar.bz2" : ".bin")),
  ).toBe(true)
  expect(VOICE_MODELS.every((model) => /^[0-9a-f]{64}$/.test(model.sha256))).toBe(true)
  expect(ids.has(DEFAULT_VOICE_MODEL)).toBe(true)
  expect(ids.has(DETECTOR_VOICE_MODEL)).toBe(true)
})

test("the default model is offered, the unmeasured small models are not", () => {
  const ids = visibleVoiceModels().map((model) => model.id)

  expect(ids).toContain(DEFAULT_VOICE_MODEL)
  expect(ids).toContain(DETECTOR_VOICE_MODEL)
  expect(ids).not.toContain("small-q5_1")
  expect(ids).not.toContain("small")
})

test("paths stay under the voice directory", () => {
  const root = "/data"
  const model = VOICE_MODELS[0]!

  expect(modelsDirectory(root)).toBe(path.join(root, "voice", "models"))
  expect(modelPath(root, model)).toBe(path.join(root, "voice", "models", model.file))
  expect(partialPath("/a/b.bin")).toBe("/a/b.bin.part")
})

test("an extracted voice resolves to its own folder", () => {
  const voice = VOICE_MODELS.find((model) => model.archive)!

  expect(modelPath("/data", voice)).toBe(path.join("/data", "voice", "models", voice.archive!.directory))
})

test("a model counts as installed only at its exact size", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "cairn-voice-"))
  const model = { ...VOICE_MODELS[0]!, file: "model.bin", size: 4 }
  const target = modelPath(root, model)

  try {
    await mkdir(path.dirname(target), { recursive: true })
    expect(isInstalled(target, model)).toBe(false)

    await writeFile(target, "abc")
    expect(isInstalled(target, model)).toBe(false)

    await writeFile(target, "abcd")
    expect(isInstalled(target, model)).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("a download lands on the target once the size matches", async () => {
  const body = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  const server = Bun.serve({ port: 0, fetch: () => new Response(body) })
  const root = await mkdtemp(path.join(tmpdir(), "cairn-voice-"))
  const target = path.join(root, "model.bin")
  const states: DownloadState[] = []

  try {
    const result = await downloadFile({
      url: `http://127.0.0.1:${server.port}/model.bin`,
      target,
      size: body.byteLength,
      sha256: digest(body),
      report: (state) => states.push(state),
    })

    expect(result.status).toBe("installed")
    expect(new Uint8Array(await readFile(target))).toEqual(body)
    expect(states.at(-1)?.status).toBe("installed")
    expect(states.some((state) => state.status === "downloading")).toBe(true)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test("a short body is rejected and left as a partial file", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response(new Uint8Array([1, 2, 3])) })
  const root = await mkdtemp(path.join(tmpdir(), "cairn-voice-"))
  const target = path.join(root, "model.bin")

  try {
    const result = await downloadFile({
      url: `http://127.0.0.1:${server.port}/model.bin`,
      target,
      size: 8,
      sha256: digest(new Uint8Array([1, 2, 3])),
      report: () => undefined,
    })

    expect(result.status).toBe("failed")
    expect(await Bun.file(target).exists()).toBe(false)
    expect(await Bun.file(partialPath(target)).exists()).toBe(false)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test("a body with the right size but the wrong digest is rejected", async () => {
  const body = new Uint8Array([1, 2, 3, 4])
  const server = Bun.serve({ port: 0, fetch: () => new Response(body) })
  const root = await mkdtemp(path.join(tmpdir(), "cairn-voice-"))
  const target = path.join(root, "model.bin")

  try {
    const result = await downloadFile({
      url: `http://127.0.0.1:${server.port}/model.bin`,
      target,
      size: body.byteLength,
      sha256: digest(new Uint8Array([4, 3, 2, 1])),
      report: () => undefined,
    })

    expect(result.status).toBe("failed")
    expect(await Bun.file(target).exists()).toBe(false)
    expect(await Bun.file(partialPath(target)).exists()).toBe(false)
  } finally {
    server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test("a failing server reports failure", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("gone", { status: 404 }) })

  try {
    const result = await downloadFile({
      url: `http://127.0.0.1:${server.port}/model.bin`,
      target: path.join(tmpdir(), "cairn-voice-404", "model.bin"),
      size: 8,
      sha256: digest(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
      report: () => undefined,
    })

    expect(result.status).toBe("failed")
  } finally {
    server.stop(true)
  }
})
