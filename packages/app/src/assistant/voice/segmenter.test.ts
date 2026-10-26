import { expect, test } from "bun:test"
import { FRAME_SAMPLES, createSpeechSegmenter, type SpeechSegment } from "./segmenter"

const FRAME_MS = 20

function feed(segmenter: ReturnType<typeof createSpeechSegmenter>, level: number, ms: number) {
  const segments: SpeechSegment[] = []
  const frames = Math.round(ms / FRAME_MS)

  for (let index = 0; index < frames; index += 1) segments.push(...segmenter.push(level, FRAME_SAMPLES))

  return segments
}

const samples = (ms: number) => Math.round((ms * 16_000) / 1000)

test("a sentence surrounded by silence yields one segment", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  const segments = feed(segmenter, 0.12, 1000)

  expect(segments).toEqual([])
  expect(feed(segmenter, 0, 1000)).toHaveLength(1)
})

test("the segment keeps a pre-roll and a tail around the speech", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  feed(segmenter, 0.12, 1000)
  const [segment] = feed(segmenter, 0, 1000)

  expect(segment.start).toBeLessThanOrEqual(samples(300))
  expect(segment.end).toBeGreaterThanOrEqual(samples(1300))
})

test("two sentences separated by a pause come out in order", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  feed(segmenter, 0.12, 800)
  feed(segmenter, 0, 1000)
  const second = feed(segmenter, 0.12, 800)
  const last = feed(segmenter, 0, 1000)

  expect(second).toEqual([])
  expect(last).toHaveLength(1)
})

test("a cough shorter than the minimum speech duration is dropped", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  feed(segmenter, 0.15, 100)
  feed(segmenter, 0, 1500)

  expect(feed(segmenter, 0.15, 800)).toEqual([])
})

test("quiet background noise does not hide a sentence", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0.004, 300)
  feed(segmenter, 0.12, 700)

  expect(feed(segmenter, 0.004, 1200)).toHaveLength(1)
})

test("a sentence that never pauses is cut at the cap", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  const segments = feed(segmenter, 0.12, 35_000)

  expect(segments).toHaveLength(1)
  expect(segments[0].end - segments[0].start).toBeLessThanOrEqual(samples(30_000) + FRAME_SAMPLES)
})

test("flush returns the sentence still being spoken", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 300)
  feed(segmenter, 0.12, 900)

  const segment = segmenter.flush()

  expect(segment).toBeDefined()
  expect(segment!.end).toBeGreaterThanOrEqual(samples(1200))
})

test("flush stays empty when nobody spoke", () => {
  const segmenter = createSpeechSegmenter()

  feed(segmenter, 0, 1000)

  expect(segmenter.flush()).toBeUndefined()
})
