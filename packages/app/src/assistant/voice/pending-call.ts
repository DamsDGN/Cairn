import { createSignal } from "solid-js"

// A call started from a draft hands its first sentence to the new-session composer, which creates the
// conversation and navigates to it. The session screen then arms this one-shot so the call dialog
// opens there and keeps speaking the answer.
const [armed, setArmed] = createSignal(false)

export const pendingVoiceCall = {
  arm() {
    setArmed(true)
  },
  take() {
    if (!armed()) return false

    setArmed(false)

    return true
  },
}
