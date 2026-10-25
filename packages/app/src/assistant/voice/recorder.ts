// Recording happens in the renderer because only a page can open the microphone. The AudioContext is
// created at 16 kHz, the rate the local recognizer expects, and Chromium resamples the device stream
// for us.
import { floatToPcm16 } from "./pcm"

const SAMPLE_RATE = 16_000

export const RECORDING_LIMIT_MS = 120_000

export type Recorder = {
  stop(): Promise<ArrayBuffer>
  cancel(): Promise<void>
}

export async function startRecorder(): Promise<Recorder> {
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
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
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
