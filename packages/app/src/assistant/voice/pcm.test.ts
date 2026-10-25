import { expect, test } from "bun:test"
import { floatToPcm16 } from "./pcm"

const cases: Array<{ name: string; input: Float32Array[]; output: number[] }> = [
  { name: "silence", input: [new Float32Array([0, 0])], output: [0, 0] },
  { name: "full negative scale", input: [new Float32Array([-1])], output: [-32768] },
  { name: "full positive scale", input: [new Float32Array([1])], output: [32767] },
  { name: "clamps above the range", input: [new Float32Array([2])], output: [32767] },
  { name: "clamps below the range", input: [new Float32Array([-2])], output: [-32768] },
  { name: "joins chunks in order", input: [new Float32Array([0.5]), new Float32Array([-0.5])], output: [16383, -16384] },
]

test.each(cases)("$name", ({ input, output }) => {
  const buffer = floatToPcm16(input)
  const view = new DataView(buffer)

  expect(buffer.byteLength).toBe(output.length * 2)
  expect(Array.from({ length: output.length }, (_, index) => view.getInt16(index * 2, true))).toEqual(output)
})
