// Dictation by sentence: the recorder reports the level of every 20 ms frame and this state machine
// decides where a spoken sentence starts and ends. Keeping it pure makes the thresholds testable
// with synthetic series, away from the microphone and the recognizer.

export const FRAME_SAMPLES = 320

export const SAMPLE_RATE = 16_000

export type SpeechSegment = { start: number; end: number }

const DEFAULTS = {
  calibrationMs: 300,
  preRollMs: 250,
  tailMs: 300,
  startMs: 150,
  endMs: 700,
  minSpeechMs: 300,
  maxSegmentMs: 30_000,
}

const HIGH_FLOOR = 0.02

const LOW_FLOOR = 0.012

export type SegmenterOptions = Partial<typeof DEFAULTS>

export function createSpeechSegmenter(options: SegmenterOptions = {}) {
  const rules = { ...DEFAULTS, ...options }
  const samples = (ms: number) => Math.round((ms * SAMPLE_RATE) / 1000)

  const calibrationFrames = Math.ceil(samples(rules.calibrationMs) / FRAME_SAMPLES)
  const preRoll = samples(rules.preRollMs)
  const tail = samples(rules.tailMs)
  const startRun = samples(rules.startMs)
  const endRun = samples(rules.endMs)
  const minSpeech = samples(rules.minSpeechMs)
  const maxSegment = samples(rules.maxSegmentMs)

  const levels: number[] = []
  let high = HIGH_FLOOR
  let low = LOW_FLOOR

  let position = 0
  let state: "waiting" | "speech" = "waiting"
  let speechRun = 0
  let runStart = 0
  let segmentStart = 0
  let lastSpeech = 0
  let silent = 0
  let speechSamples = 0

  const calibrate = () => {
    const sorted = levels.toSorted((a, b) => a - b)
    // A recording that starts mid-sentence must not raise the threshold until nothing is detected, so
    // the noise floor is capped.
    const noise = Math.min(sorted[Math.floor(sorted.length / 2)] ?? 0, HIGH_FLOOR)

    high = Math.max(HIGH_FLOOR, noise * 4)
    low = Math.max(LOW_FLOOR, noise * 2)
  }

  const finish = (end: number): SpeechSegment | undefined => {
    const segment = { start: Math.max(0, segmentStart), end: Math.min(end, position) }
    const spoken = speechSamples

    state = "waiting"
    speechRun = 0
    speechSamples = 0

    if (spoken < minSpeech) return undefined

    if (segment.end - segment.start < minSpeech) return undefined

    return segment
  }

  const begin = () => {
    state = "speech"
    segmentStart = Math.max(0, runStart - preRoll)
    lastSpeech = position
    silent = 0
    speechSamples = Math.max(speechRun, FRAME_SAMPLES)
  }

  return {
    push(level: number, count = FRAME_SAMPLES): SpeechSegment[] {
      const start = position
      position += count

      if (levels.length < calibrationFrames) {
        levels.push(level)

        if (levels.length === calibrationFrames) calibrate()

        return []
      }

      if (state === "waiting") {
        if (level < high) {
          speechRun = 0

          return []
        }

        if (speechRun === 0) runStart = start
        speechRun += count

        if (speechRun < startRun) return []

        begin()

        return []
      }

      if (level >= low) {
        speechSamples += count
        lastSpeech = position
        silent = 0
      } else {
        silent += count

        if (silent >= endRun) {
          const segment = finish(lastSpeech + tail)

          return segment ? [segment] : []
        }
      }

      if (position - segmentStart >= maxSegment) {
        const segment = { start: segmentStart, end: position }

        state = "waiting"
        speechRun = 0
        speechSamples = 0

        return [segment]
      }

      return []
    },

    flush(): SpeechSegment | undefined {
      if (state !== "speech") return undefined

      return finish(lastSpeech + tail)
    },
  }
}
