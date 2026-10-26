import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { Transferable } from "effect/workers"

const ModelID = Schema.Literals([
  "base-q5_1",
  "small-q5_1",
  "small",
  "silero-v6.2.0",
  "vits-piper-fr_FR-siwis-medium",
  "vits-piper-fr_FR-upmc-medium",
  "vits-coqui-fr-css10",
  "vits-piper-en_US-lessac-medium",
  "vits-piper-en_US-ryan-high",
  "vits-piper-en_GB-alba-medium",
])
const VoiceLanguage = Schema.Literals(["fr", "en"])
const ModelStatus = Schema.Literals(["idle", "downloading", "installed", "failed"])
const Acceleration = Schema.Literals(["avx2", "compatible"])

const ModelState = Schema.Struct({
  id: ModelID,
  status: ModelStatus,
  received: Schema.Number,
  total: Schema.Number,
})

export type VoiceModelID = typeof ModelID.Type
export type VoicePreferences = typeof Preferences.Type
export type VoiceModelState = typeof ModelState.Type

const Preferences = Schema.Struct({
  language: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  /** Synthesis voice the user picked; its language is the language Cairn speaks. */
  voice: Schema.optional(ModelID),
})

const ModelInfo = Schema.Struct({
  id: ModelID,
  kind: Schema.Literals(["speech", "detector", "synthesis"]),
  installed: Schema.Boolean,
  size: Schema.Number,
  language: Schema.optional(VoiceLanguage),
})

// The local voice models live in the app data folder and are downloaded on request, so a fresh
// install stays small and the download is an explicit choice instead of a surprise.
export const VoiceLocalModels = Rpc.make("VoiceLocalModels", {
  success: Schema.Struct({ models: Schema.Array(ModelInfo) }),
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

export const VoiceLocalPreferences = Rpc.make("VoiceLocalPreferences", {
  success: Preferences,
})

export const VoiceLocalPreferencesSet = Rpc.make("VoiceLocalPreferencesSet", {
  payload: {
    language: Schema.optional(Schema.String),
    prompt: Schema.optional(Schema.String),
    voice: Schema.optional(ModelID),
  },
  success: Preferences,
})

export const VoiceLocalAcceleration = Rpc.make("VoiceLocalAcceleration", {
  success: Schema.Struct({ level: Acceleration }),
})

export const VoiceLocalTranscribe = Rpc.make("VoiceLocalTranscribe", {
  payload: {
    audio: Transferable.Uint8Array,
    language: Schema.String,
    prompt: Schema.optional(Schema.String),
    id: Schema.optional(ModelID),
  },
  success: Schema.Struct({ text: Schema.String }),
})

export const VoiceLocalSpeak = Rpc.make("VoiceLocalSpeak", {
  payload: {
    text: Schema.String,
    id: Schema.optional(ModelID),
  },
  success: Schema.Struct({ audio: Transferable.Uint8Array, sampleRate: Schema.Number }),
})

export const VoiceRpcs = RpcGroup.make(
  VoiceLocalModels,
  VoiceLocalDownload,
  VoiceLocalState,
  VoiceLocalRemove,
  VoiceLocalPreferences,
  VoiceLocalPreferencesSet,
  VoiceLocalAcceleration,
  VoiceLocalTranscribe,
  VoiceLocalSpeak,
)
