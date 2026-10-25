import { app } from "electron"
import { Effect } from "effect"

import { VoiceRpcs } from "../../shared/ipc-rpc"
import { createVoiceDownloader } from "../voice/download"
import { DEFAULT_VOICE_MODEL, VOICE_MODELS, isInstalled, modelPath } from "../voice/models"
import { transcribe } from "../voice/transcribe"

export const voiceHandlers = VoiceRpcs.toLayer(
  Effect.gen(function* () {
    const dataDirectory = app.getPath("userData")
    const downloader = createVoiceDownloader(dataDirectory)

    return VoiceRpcs.of({
      VoiceLocalModels: () =>
        Effect.sync(() => ({
          models: VOICE_MODELS.map((model) => ({
            id: model.id,
            installed: isInstalled(modelPath(dataDirectory, model), model),
            size: model.size,
          })),
        })),
      VoiceLocalDownload: ({ id }) =>
        Effect.promise(() => downloader.start(id)).pipe(Effect.map((state) => ({ id, ...state }))),
      VoiceLocalState: ({ id }) => Effect.sync(() => ({ id, ...downloader.read(id) })),
      VoiceLocalRemove: ({ id }) => Effect.promise(() => downloader.remove(id)),
      VoiceLocalTranscribe: ({ audio, language, id }) =>
        Effect.promise(() =>
          transcribe({
            dataDirectory,
            id: id ?? DEFAULT_VOICE_MODEL,
            audio: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer,
            language,
          }),
        ).pipe(Effect.map((text) => ({ text }))),
    })
  }),
)
