// whisper.cpp picks its CPU kernel at compile time, not at runtime: the AVX2 build contains AVX2
// instructions in paths every transcription takes. Loading it on a processor without the full set
// would raise SIGILL, so the flags are checked before the addon is imported.
const AVX2_FLAGS = ["avx", "avx2", "fma", "f16c", "bmi2"] as const

// Eight threads was the best result on the reference machine; more did not help, and the smaller
// cores of a hybrid processor only add latency. One core stays free for the interface.
const MAX_THREADS = 8

export type Acceleration = "avx2" | "compatible"

export function cpuFlags(cpuinfo: string): string[] {
  const line = cpuinfo.split("\n").find((entry) => entry.startsWith("flags"))

  if (!line) return []

  return line
    .slice(line.indexOf(":") + 1)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function supportsAvx2(flags: readonly string[]): boolean {
  return AVX2_FLAGS.every((flag) => flags.includes(flag))
}

export function acceleration(platform: string, arch: string, cpuinfo: string): Acceleration {
  if (platform !== "linux" || arch !== "x64") return "compatible"

  return supportsAvx2(cpuFlags(cpuinfo)) ? "avx2" : "compatible"
}

export function voiceThreads(parallelism: number): number {
  return Math.max(1, Math.min(MAX_THREADS, parallelism - 1))
}
