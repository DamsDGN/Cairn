import type { Configuration } from "electron-builder"

import { getConfig } from "./electron-builder.config"

const config: Configuration & { mac?: NonNullable<Configuration["mac"]> } = getConfig()

config.mac = {
  ...config.mac,
  // Cross-built on Linux: no codesign, no notarize, zip only (DMG needs hdiutil on macOS).
  hardenedRuntime: false,
  gatekeeperAssess: false,
  sign: undefined,
  notarize: false,
  target: ["zip"],
}

export default config
