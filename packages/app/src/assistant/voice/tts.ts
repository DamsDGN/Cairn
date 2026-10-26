// Speech playback for the voice conversation. The audio is synthesized on this machine by the
// desktop main process and handed over as signed 16-bit mono PCM, so the conversation never leaves
// the computer.

export type Speaker = {
  speak(text: string): Promise<void>
  stop(): void
  dispose(): void
}

export type Synthesis = (text: string) => Promise<{ audio: ArrayBuffer; sampleRate: number }>

export function createSpeaker(synthesize: Synthesis): Speaker {
  let context: AudioContext | undefined
  let source: AudioBufferSourceNode | undefined
  let generation = 0

  const stop = () => {
    generation += 1

    try {
      source?.stop()
    } catch {
      // Already ended.
    }

    source = undefined
  }

  return {
    async speak(text: string) {
      stop()

      const run = generation
      const result = await synthesize(text)

      // A sentence synthesized while the user was interrupting us must not play.
      if (run !== generation) return

      context ??= new AudioContext()
      await context.resume()

      const samples = new Int16Array(result.audio)
      const buffer = context.createBuffer(1, samples.length, result.sampleRate)
      const channel = buffer.getChannelData(0)

      for (const [index, sample] of samples.entries()) channel[index] = sample / 0x8000

      const node = context.createBufferSource()

      node.buffer = buffer
      node.connect(context.destination)
      source = node

      await new Promise<void>((resolve) => {
        node.onended = () => resolve()
        node.start()
      })

      if (source === node) source = undefined
    },
    stop,
    dispose() {
      stop()
      void context?.close()
      context = undefined
    },
  }
}
