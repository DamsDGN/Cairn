// Recording happens in the renderer because only a page can open the microphone. The AudioContext is
// created at 16 kHz, the rate the local recognizer expects, and Chromium resamples the device stream
// for us.
import { floatToPcm16 } from "./pcm"

export const FRAME_SAMPLES = 320

const SAMPLE_RATE = 16_000

export const RECORDING_LIMIT_MS = 120_000

export type RecorderFrame = { samples: Float32Array; level: number }

export type Recorder = {
  stop(): Promise<ArrayBuffer>
  cancel(): Promise<void>
}

export type RecorderOptions = {
  /** Called for every 20 ms frame, with its root mean square level in [0, 1]. */
  onFrame?: (frame: RecorderFrame) => void
}

function level(samples: Float32Array) {
  let total = 0

  for (const sample of samples) total += sample * sample

  return Math.sqrt(total / samples.length)
}

export async function startRecorder(options: RecorderOptions = {}): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })

  const context = new AudioContext({ sampleRate: SAMPLE_RATE })
  await context.resume()

  const source = context.createMediaStreamSource(stream)
  const processor = context.createScriptProcessor(4096, 1, 1)
  // A ScriptProcessor only runs while it is connected to the destination; a muted gain node keeps the
  // microphone out of the speakers.
  const mute = context.createGain()
  mute.gain.value = 0

  const chunks: Float32Array[] = []
  processor.onaudioprocess = (event) => {
    const block = new Float32Array(event.inputBuffer.getChannelData(0))

    chunks.push(block)

    for (let offset = 0; offset < block.length; offset += FRAME_SAMPLES) {
      const frame = block.subarray(offset, Math.min(offset + FRAME_SAMPLES, block.length))

      options.onFrame?.({ samples: new Float32Array(frame), level: level(frame) })
    }
  }

  source.connect(processor)
  processor.connect(mute)
  mute.connect(context.destination)

  let closed = false

  const close = async () => {
    if (closed) return
    closed = true
    processor.onaudioprocess = null
    processor.disconnect()
    source.disconnect()
    mute.disconnect()

    for (const track of stream.getTracks()) track.stop()

    await context.close()
  }

  return {
    async stop() {
      await close()

      return floatToPcm16(chunks)
    },
    cancel: close,
  }
}
