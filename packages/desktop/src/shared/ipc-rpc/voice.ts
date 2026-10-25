import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { Transferable } from "effect/workers"

const ModelID = Schema.Literals(["base-q5_1", "small-q5_1", "small"])
const ModelStatus = Schema.Literals(["idle", "downloading", "installed", "failed"])

const ModelState = Schema.Struct({
  id: ModelID,
  status: ModelStatus,
  received: Schema.Number,
  total: Schema.Number,
})

export type VoiceModelID = typeof ModelID.Type
export type VoiceModelState = typeof ModelState.Type

const InstalledModel = Schema.Struct({
  id: ModelID,
  installed: Schema.Boolean,
})

// The local voice models live in the app data folder and are downloaded on request, so a fresh
// install stays small and the download is an explicit choice instead of a surprise.
export const VoiceLocalModels = Rpc.make("VoiceLocalModels", {
  success: Schema.Struct({ models: Schema.Array(InstalledModel) }),
})

export const VoiceLocalDownload = Rpc.make("VoiceLocalDownload", {
  payload: { id: ModelID },
  success: ModelState,
})

export const VoiceLocalRemove = Rpc.make("VoiceLocalRemove", {
  payload: { id: ModelID },
  success: Schema.Boolean,
})

export const VoiceLocalState = Rpc.make("VoiceLocalState", {
  payload: { id: ModelID },
  success: ModelState,
})

export const VoiceLocalTranscribe = Rpc.make("VoiceLocalTranscribe", {
  payload: {
    audio: Transferable.Uint8Array,
    language: Schema.optional(Schema.String),
    id: Schema.optional(ModelID),
  },
  success: Schema.Struct({ text: Schema.String }),
})

export const VoiceRpcs = RpcGroup.make(
  VoiceLocalModels,
  VoiceLocalDownload,
  VoiceLocalState,
  VoiceLocalRemove,
  VoiceLocalTranscribe,
)
