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
