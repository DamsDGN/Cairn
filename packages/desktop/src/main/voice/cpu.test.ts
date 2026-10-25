import { expect, test } from "bun:test"
import { acceleration, cpuFlags, supportsAvx2 } from "./cpu"

const intel = `processor\t: 0
model name\t: 13th Gen Intel(R) Core(TM) i7-1360P
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp lm constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc cpuid aperfmperf tsc_known_freq pni pclmulqdq dtes64 monitor ds_cpl vmx smx est tm2 ssse3 sdbg fma cx16 xtpr pdcm pcid sse4_1 sse4_2 x2apic movbe popcnt avx f16c rdrand lahf_lm abm 3dnowprefetch cpuid_fault epb ssbd ibrs ibpb stibp avx2 bmi1 bmi2 fma`

const amd = `processor\t: 0
model name\t: AMD Ryzen 5 5600G with Radeon Graphics
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush mmx fxsr sse sse2 ht syscall nx mmxext fxsr_opt pdpe1gb rdtscp lm constant_tsc rep_good nopl cpuid extd_apicid tsc_known_freq pni pclmulqdq ssse3 fma cx16 sse4_1 sse4_2 movbe popcnt aes xsave avx f16c rdrand avx2 bmi1 bmi2`

const celeron = `processor\t: 0
model name\t: Intel(R) Celeron(R) N4000 CPU @ 1.10GHz
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx pdpe1gb rdtscp lm constant_tsc art arch_perfmon pebs bts rep_good nopl xtopology nonstop_tsc cpuid aperfmperf tsc_known_freq pni pclmulqdq dtes64 monitor ds_cpl vmx est tm2 ssse3 sdbg cx16 xtpr pdcm sse4_1 sse4_2 movbe popcnt aes xsave rdrand lahf_lm 3dnowprefetch`

const coreTwo = `processor\t: 0
model name\t: Intel(R) Core(TM)2 Duo CPU     P8600  @ 2.40GHz
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov pat pse36 clflush dts acpi mmx fxsr sse sse2 ss ht tm pbe syscall nx lm constant_tsc arch_perfmon pebs bts rep_good nopl pni monitor ds_cpl est tm2 ssse3 cx16 xtpr lahf_lm`

test.each([
  { name: "an Intel hybrid laptop exposes the full AVX2 set", cpuinfo: intel, avx2: true },
  { name: "a recent AMD desktop exposes the full AVX2 set", cpuinfo: amd, avx2: true },
  { name: "a low-power Celeron stops at SSE4.2", cpuinfo: celeron, avx2: false },
  { name: "a Core 2 Duo predates AVX", cpuinfo: coreTwo, avx2: false },
  { name: "an unreadable file yields no flags", cpuinfo: "", avx2: false },
])("$name", ({ cpuinfo, avx2 }) => {
  expect(supportsAvx2(cpuFlags(cpuinfo))).toBe(avx2)
})

test("reads the flags line, not the model name", () => {
  expect(cpuFlags(intel)).toContain("avx2")
  expect(cpuFlags(intel)).not.toContain("processor")
})

test("requires every flag the AVX2 kernel relies on", () => {
  expect(supportsAvx2(["avx", "avx2", "fma", "f16c"])).toBe(false)
  expect(supportsAvx2(["avx", "avx2", "fma", "f16c", "bmi2"])).toBe(true)
})

test.each([
  { name: "Linux x64 with AVX2 uses the optimized addon", platform: "linux", arch: "x64", cpuinfo: intel, level: "avx2" },
  { name: "Linux x64 without AVX2 keeps the portable addon", platform: "linux", arch: "x64", cpuinfo: celeron, level: "compatible" },
  { name: "Linux arm64 has no AVX2 build", platform: "linux", arch: "arm64", cpuinfo: intel, level: "compatible" },
  { name: "Windows keeps its own addon", platform: "win32", arch: "x64", cpuinfo: intel, level: "compatible" },
])("$name", ({ platform, arch, cpuinfo, level }) => {
  expect(acceleration(platform, arch, cpuinfo)).toBe(level as "avx2" | "compatible")
})
