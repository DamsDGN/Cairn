#!/usr/bin/env bun
import { $ } from "bun"
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

// The prebuilt Linux x64 addon of @fugood/whisper.node runs the generic C kernels: the package
// passes the Node architecture name ("x64") to ggml as CMAKE_SYSTEM_PROCESSOR, which ggml does not
// recognise, so it falls back to scalar code. This script clones the same release, fixes that one
// line, and builds the addon for the Haswell instruction set (AVX2, FMA, F16C, BMI2). The portable
// addon from npm stays in the package as the fallback for older processors.
const REPO = "https://github.com/mybigday/whisper.node.git"

const REF = "1.1.3"

const COMMIT = "3e05649a6aab6c52bb566ef731231ba5296b7885"

const SOURCE = path.join(tmpdir(), "cairn-whisper-avx2")

const DESKTOP = path.join(import.meta.dir, "..")

const TARGET = path.join(DESKTOP, "resources", "whisper-avx2")

rmSync(SOURCE, { recursive: true, force: true })

await $`git clone --depth 1 --branch ${REF} --recurse-submodules --shallow-submodules ${REPO} ${SOURCE}`

const head = (await $`git -C ${SOURCE} rev-parse HEAD`.text()).trim()

if (head !== COMMIT) throw new Error(`${REF} resolved to ${head}, expected ${COMMIT}`)

const cmake = path.join(SOURCE, "CMakeLists.txt")

const anchor = "set(CMAKE_SYSTEM_PROCESSOR ${NODE_ARCH})"

const original = readFileSync(cmake, "utf8")

if (!original.includes(anchor)) throw new Error(`the CMakeLists of ${REF} changed, review this script`)

writeFileSync(
  cmake,
  original.replace(
    anchor,
    `${anchor}

# ggml matches this variable against canonical names; Node reports "x64".
if (CMAKE_SYSTEM_PROCESSOR STREQUAL "x64")
  set(CMAKE_SYSTEM_PROCESSOR x86_64)
endif()`,
  ),
)

await $`bun install`.cwd(SOURCE)

await $`bunx cmake-js rebuild -C --CDTO_PACKAGE=ON --CDCLANG_USE_GOMP=ON --CDGGML_NATIVE=OFF --CDGGML_AVX=ON --CDGGML_AVX2=ON --CDGGML_FMA=ON --CDGGML_F16C=ON --CDGGML_BMI2=ON`.cwd(
  SOURCE,
)

const built = path.join(SOURCE, "packages", "node-whisper-linux-x64", "index.node")

const target = path.join(TARGET, "index.node")

mkdirSync(TARGET, { recursive: true })

copyFileSync(built, target)

// A build that silently fell back to the generic kernels would look correct and be ten times slower,
// so the instruction set is checked before the artifact is kept.
const disassembly = await $`objdump -d --no-show-raw-insn ${target}`.text()

if (!/%ymm/.test(disassembly)) throw new Error("the addon contains no AVX2 instructions")

console.log(`whisper AVX2 addon: ${target}`)
