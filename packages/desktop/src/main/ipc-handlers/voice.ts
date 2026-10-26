import { app } from "electron"
import { Effect } from "effect"

import { VoiceRpcs } from "../../shared/ipc-rpc"
import { createVoiceDownloader } from "../voice/download"
import { DEFAULT_VOICE_MODEL, SYNTHESIS_VOICE_MODEL, isInstalled, modelPath, visibleVoiceModels } from "../voice/models"
import { readVoicePreferences, writeVoicePreferences } from "../voice/preferences-store"
import { synthesize } from "../voice/speak"
import { accelerationLevel, transcribe } from "../voice/transcribe"

export const voiceHandlers = VoiceRpcs.toLayer(
  Effect.gen(function* () {
    const dataDirectory = app.getPath("userData")
    const downloader = createVoiceDownloader(dataDirectory)

    return VoiceRpcs.of({
      VoiceLocalModels: () =>
        Effect.sync(() => ({
          models: visibleVoiceModels().map((model) => ({
            id: model.id,
            kind: model.kind,
            installed: isInstalled(modelPath(dataDirectory, model), model),
            size: model.size,
          })),
        })),
      VoiceLocalDownload: ({ id }) =>
        Effect.promise(() => downloader.start(id)).pipe(Effect.map((state) => ({ id, ...state }))),
      VoiceLocalState: ({ id }) => Effect.sync(() => ({ id, ...downloader.read(id) })),
      VoiceLocalRemove: ({ id }) => Effect.promise(() => downloader.remove(id)),
      VoiceLocalPreferences: () => Effect.sync(() => readVoicePreferences()),
      VoiceLocalPreferencesSet: (input) => Effect.sync(() => writeVoicePreferences(input)),
      VoiceLocalAcceleration: () => Effect.sync(() => ({ level: accelerationLevel() })),
      VoiceLocalSpeak: ({ text, id }) =>
        Effect.promise(() => synthesize({ dataDirectory, id: id ?? SYNTHESIS_VOICE_MODEL, text })).pipe(
          Effect.map((result) => ({ audio: result.audio, sampleRate: result.sampleRate })),
        ),
      VoiceLocalTranscribe: ({ audio, language, prompt, id }) =>
        Effect.promise(() =>
          transcribe({
            dataDirectory,
            id: id ?? DEFAULT_VOICE_MODEL,
            audio: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer,
            language,
            prompt,
          }),
        ).pipe(Effect.map((text) => ({ text }))),
    })
  }),
)
