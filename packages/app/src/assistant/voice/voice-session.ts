import type { VoiceModel } from "@opencode/client/promise"
import type { ServerSDK } from "@/runtime/server/client"

export type VoicePhase = "connecting" | "ready" | "listening" | "responding"

export type VoiceEvent =
  | { type: "phase"; phase: VoicePhase }
  | { type: "user"; text: string }
  | { type: "assistant"; delta: string }
  | { type: "error"; message: string }

export type VoiceHandle = {
  readonly model: VoiceModel
  dispose: () => void
}

type VoiceSink = (event: VoiceEvent) => void

export async function startVoiceSession(input: {
  sdk: ServerSDK
  model: VoiceModel
  onEvent: VoiceSink
}): Promise<VoiceHandle> {
  const { sdk, model, onEvent } = input

  if (!model.transports.includes("webrtc")) throw new Error("voice: transport webrtc is required")

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const pc = new RTCPeerConnection()

  const dispose = () => {
    pc.onconnectionstatechange = null

    for (const track of stream.getTracks()) track.stop()
    pc.close()
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      onEvent({ type: "error", message: `voice: connection ${pc.connectionState}` })
    }
  }

  try {
    const channel = pc.createDataChannel("voice-events")

    channel.onopen = () => onEvent({ type: "phase", phase: "ready" })
    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return
      handleRealtimeEvent(event.data, onEvent)
    }

    pc.addTrack(stream.getTracks()[0], stream)
    const offer = await pc.createOffer({ offerToReceiveAudio: true })
    await pc.setLocalDescription(offer)
    const dcid = channel.id === null ? undefined : channel.id
    const response = await sdk.api.voice.session({
      model: model.model,
      transport: {
        type: "webrtc",
        sdp: offer.sdp ?? "",
        ...(dcid === undefined ? {} : { dcid }),
      },
    })

    const answer = response.transport
    if (answer.type !== "webrtc") throw new Error("voice: the server answered with a non-WebRTC transport")
    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp })

    return { model, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}

// Realtime data-channel events from the OpenAI-family engines; unknown events are ignored so other
// engines can route through the same sink.
function handleRealtimeEvent(data: string, onEvent: VoiceSink) {
  if (!data.startsWith("{")) return

  let event: Record<string, unknown>

  try {
    event = JSON.parse(data)
  } catch {
    return
  }

  const type = typeof event.type === "string" ? event.type : ""

  if (type === "input_audio_buffer.speech_started") {
    onEvent({ type: "phase", phase: "listening" })
  } else if (type === "input_audio_buffer.speech_stopped") {
    onEvent({ type: "phase", phase: "responding" })
  } else if (type === "conversation.item.input_audio_transcription.completed") {
    const text = typeof event.transcript === "string" ? event.transcript.trim() : ""

    if (text) onEvent({ type: "user", text })
  } else if (type === "response.output_text.delta" || type === "response.audio_transcript.delta") {
    onEvent({ type: "assistant", delta: typeof event.delta === "string" ? event.delta : "" })
  } else if (type === "response.created") {
    onEvent({ type: "phase", phase: "responding" })
  } else if (type === "response.done" || type === "session.created" || type === "session.updated") {
    onEvent({ type: "phase", phase: "ready" })
  } else if (type === "error") {
    const error = event.error

    onEvent({
      type: "error",
      message:
        error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string"
          ? ((error as Record<string, unknown>).message as string)
          : "voice: realtime error",
    })
  }
}

/** Models usable in a WebRTC voice call the server can broker, hosted-console first. */
export function pickVoiceModel(models: readonly VoiceModel[]): VoiceModel | undefined {
  return models
    .filter((model) => model.available && model.transports.includes("webrtc"))
    .toSorted((a, b) => Number(b.integration === "opencode") - Number(a.integration === "opencode"))[0]
}

export function describeVoiceError(error: unknown) {
  if (!(error instanceof Error)) return String(error)

  return error.message.startsWith("voice: ") ? error.message.slice("voice: ".length) : error.message
}
