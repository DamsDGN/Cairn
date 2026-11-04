import { createSignal } from "solid-js"

// A capture started outside the composer, from the global shortcut or the tray, is armed here and
// claimed by the draft composer that mounts next. The revision keeps the composer already on screen
// from claiming it while the new conversation is being opened, and a second trigger while a capture
// records stops it instead of opening another conversation.
type Capture = {
  recording(): boolean
  finish(): void
}

const [requested, setRequested] = createSignal(0)

let revision = 0
let active: Capture | undefined

export const dictationCapture = {
  request() {
    revision += 1
    setRequested(revision)
  },
  revision: () => revision,
  /** A composer only claims a request that was posted before it mounted. */
  claim(mountedRevision: number) {
    const pending = requested()

    if (!pending || mountedRevision < pending) return false

    setRequested(0)

    return true
  },
  attach(capture: Capture) {
    active = capture
  },
  detach(capture: Capture) {
    if (active === capture) active = undefined
  },
  /** Stops the capture that is recording; false when nothing was recording. */
  stop() {
    if (!active?.recording()) return false

    active.finish()

    return true
  },
}
