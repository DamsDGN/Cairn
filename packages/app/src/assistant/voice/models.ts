import { createResource, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import {
  usePlatform,
  type VoiceLocalLanguage,
  type VoiceLocalModel,
  type VoiceLocalModelID,
  type VoiceLocalState,
} from "@/runtime/platform/platform"

const POLL_MS = 400

// Dictation uses the default model when it is installed, then any other speech model. Older
// profiles still hold one of the small models, which are no longer offered.
const PREFERENCE: VoiceLocalModelID[] = ["base-q5_1", "small", "small-q5_1"]

export function useVoiceModels() {
  const platform = usePlatform()
  const [models, { refetch }] = createResource<VoiceLocalModel[]>(async () => {
    return (await platform.voiceLocal?.models()) ?? []
  }, { initialValue: [] })

  const [states, setStates] = createStore<Record<string, VoiceLocalState | undefined>>({})

  const timers = new Map<VoiceLocalModelID, ReturnType<typeof setInterval>>()

  const clear = (id: VoiceLocalModelID) => {
    const timer = timers.get(id)

    if (timer) clearInterval(timer)
    timers.delete(id)
  }

  onCleanup(() => {
    for (const id of [...timers.keys()]) clear(id)
  })

  const watch = (id: VoiceLocalModelID) =>
    new Promise<void>((resolve, reject) => {
      timers.set(
        id,
        setInterval(async () => {
          const state = await platform.voiceLocal!.state(id).catch(() => undefined)

          if (!state) return
          setStates(id, state)

          if (state.status === "installed") {
            clear(id)
            await refetch()
            resolve()

            return
          }

          if (state.status === "failed") {
            clear(id)
            reject(new Error("download failed"))
          }
        }, POLL_MS),
      )
    })

  const download = async (id: VoiceLocalModelID) => {
    if (!platform.voiceLocal) return

    const state = await platform.voiceLocal.download(id)
    setStates(id, state)
    await watch(id)
  }

  const remove = async (id: VoiceLocalModelID) => {
    if (!platform.voiceLocal) return

    clear(id)
    await platform.voiceLocal.remove(id)
    setStates(id, undefined)
    await refetch()
  }

  const state = (id: VoiceLocalModelID) => states[id] ?? { id, status: "idle" as const, received: 0, total: 0 }

  const progress = (id: VoiceLocalModelID) => {
    const current = state(id)

    return current.total > 0 ? current.received / current.total : 0
  }

  const installed = () => (models() ?? []).filter((model) => model.installed)

  const speech = () => (models() ?? []).filter((model) => model.kind === "speech")

  const best = () => PREFERENCE.find((id) => installed().some((model) => model.id === id))

  const synthesis = () => installed().find((model) => model.kind === "synthesis")

  // Voices are offered per spoken language, and a voice names the language it speaks.
  const voices = (language?: VoiceLocalLanguage) =>
    (models() ?? []).filter(
      (model) => model.kind === "synthesis" && (language === undefined || model.language === language),
    )

  const voice = (id?: VoiceLocalModelID) =>
    installed().find((model) => model.kind === "synthesis" && model.id === id)

  return { models, states, state, progress, download, remove, installed, speech, best, synthesis, voices, voice, refetch }
}

export type VoiceModels = ReturnType<typeof useVoiceModels>
