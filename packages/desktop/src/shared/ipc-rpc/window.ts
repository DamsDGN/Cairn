import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const WindowThemeReady = Rpc.make("WindowThemeReady")

export const WindowGetFocused = Rpc.make("WindowGetFocused", { success: Schema.Boolean })

export const WindowGetFullscreen = Rpc.make("WindowGetFullscreen", { success: Schema.Boolean })

export const WindowSetFocus = Rpc.make("WindowSetFocus")

export const WindowShow = Rpc.make("WindowShow")

export const WindowGetZoomFactor = Rpc.make("WindowGetZoomFactor", { success: Schema.Number })

export const WindowSetZoomFactor = Rpc.make("WindowSetZoomFactor", {
  payload: { factor: Schema.Number },
})

export const WindowGetPinchZoomEnabled = Rpc.make("WindowGetPinchZoomEnabled", {
  success: Schema.Boolean,
})

export const WindowSetPinchZoomEnabled = Rpc.make("WindowSetPinchZoomEnabled", {
  payload: { enabled: Schema.Boolean },
})

export const WindowMinimize = Rpc.make("WindowMinimize")

export const WindowGetMaximized = Rpc.make("WindowGetMaximized", { success: Schema.Boolean })

export const WindowToggleMaximize = Rpc.make("WindowToggleMaximize", { success: Schema.Boolean })

export const WindowClose = Rpc.make("WindowClose")

export const WindowSetTitlebar = Rpc.make("WindowSetTitlebar", {
  payload: {
    theme: Schema.Struct({
      mode: Schema.Literals(["light", "dark"]),
      scheme: Schema.optionalKey(Schema.Literals(["system", "light", "dark"])),
    }),
  },
})

export const WindowRpcs = RpcGroup.make(
  WindowThemeReady,
  WindowGetFocused,
  WindowGetFullscreen,
  WindowSetFocus,
  WindowShow,
  WindowGetZoomFactor,
  WindowSetZoomFactor,
  WindowGetPinchZoomEnabled,
  WindowSetPinchZoomEnabled,
  WindowMinimize,
  WindowGetMaximized,
  WindowToggleMaximize,
  WindowClose,
  WindowSetTitlebar,
)
