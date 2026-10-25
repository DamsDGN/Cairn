import { describe, expect, test } from "bun:test"
import { contrastRatio } from "../color"
import type { DesktopTheme, HexColor, ResolvedV2Theme } from "../types"
import { resolveThemeV2 } from "../v2/resolve"

const theme: DesktopTheme = await Bun.file(new URL("./cairn.json", import.meta.url)).json()

function color(tokens: ResolvedV2Theme, name: string): HexColor {
  const value = tokens[name]
  const ref = typeof value === "string" ? value.match(/^var\(--([a-z0-9-]+)\)$/i) : null
  const resolved = ref ? tokens[ref[1]] : value

  if (typeof resolved !== "string" || !resolved.startsWith("#")) throw new Error(`Cannot resolve ${name}`)

  return resolved.slice(0, 7) as HexColor
}

describe("cairn theme", () => {
  const { light, dark } = resolveThemeV2(theme)

  test.each([
    { mode: "light", tokens: light, base: "#f7f4ec", text: "#2b2a27", accent: "#b04a28" },
    { mode: "dark", tokens: dark, base: "#201e1b", text: "#eceae3", accent: "#e0805c" },
  ])("$mode surfaces and foregrounds resolve to the brand palette", ({ tokens, base, text, accent }) => {
    expect(color(tokens, "v2-background-bg-base")).toBe(base)
    expect(color(tokens, "v2-text-text-base")).toBe(text)
    expect(color(tokens, "v2-text-text-accent")).toBe(accent)
  })

  test.each([
    { mode: "light", tokens: light },
    { mode: "dark", tokens: dark },
  ])("$mode text roles meet WCAG AA on the app background", ({ tokens }) => {
    const background = color(tokens, "v2-background-bg-base")

    expect(contrastRatio(color(tokens, "v2-text-text-base"), background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(color(tokens, "v2-text-text-muted"), background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(color(tokens, "v2-text-text-faint"), background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(color(tokens, "v2-text-text-accent"), background)).toBeGreaterThanOrEqual(4.5)
  })
})
