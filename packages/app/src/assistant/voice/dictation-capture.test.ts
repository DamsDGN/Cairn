import { expect, test } from "bun:test"
import { dictationCapture } from "./dictation-capture"

test("a draft mounted after the request claims it exactly once", () => {
  dictationCapture.request()
  const mounted = dictationCapture.revision()

  expect(dictationCapture.claim(mounted)).toBe(true)
  expect(dictationCapture.claim(mounted)).toBe(false)
})

test("a composer mounted before the request leaves it to the next draft", () => {
  const mounted = dictationCapture.revision()

  dictationCapture.request()

  expect(dictationCapture.claim(mounted)).toBe(false)
  expect(dictationCapture.claim(dictationCapture.revision())).toBe(true)
})

test("stopping a recording capture finishes it", () => {
  let finished = 0

  dictationCapture.attach({
    recording: () => true,
    finish: () => {
      finished += 1
    },
  })

  expect(dictationCapture.stop()).toBe(true)
  expect(finished).toBe(1)
})

test("an idle capture is not stopped", () => {
  dictationCapture.attach({
    recording: () => false,
    finish: () => {
      throw new Error("an idle capture must not finish")
    },
  })

  expect(dictationCapture.stop()).toBe(false)
})

test("a detached capture no longer receives the stop", () => {
  const capture = { recording: () => true, finish: () => undefined }

  dictationCapture.attach(capture)
  dictationCapture.detach(capture)

  expect(dictationCapture.stop()).toBe(false)
})
