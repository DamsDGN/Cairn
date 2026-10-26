// whisper.cpp reads mono signed 16-bit little-endian samples. Samples outside [-1, 1] are clamped
// instead of wrapped, which would turn a loud syllable into noise.
export function floatToPcm16(chunks: Float32Array[]) {
  const samples = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const buffer = new ArrayBuffer(samples * 2)
  const view = new DataView(buffer)
  let offset = 0

  for (const chunk of chunks) {
    for (const sample of chunk) {
      const value = Math.max(-1, Math.min(1, sample))

      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true)
      offset += 2
    }
  }

  return buffer
}

/** Copies the samples between two offsets, as the segmenter reports them. */
export function sliceSamples(chunks: Float32Array[], start: number, end: number) {
  const output = new Float32Array(Math.max(0, end - start))
  let offset = 0
  let written = 0

  for (const chunk of chunks) {
    const chunkEnd = offset + chunk.length

    if (chunkEnd > start && offset < end) {
      const from = Math.max(0, start - offset)
      const to = Math.min(chunk.length, end - offset)

      output.set(chunk.subarray(from, to), written)
      written += to - from
    }

    offset = chunkEnd

    if (offset >= end) break
  }

  return written === output.length ? output : output.subarray(0, written)
}
