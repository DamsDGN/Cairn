import { createSignal } from "solid-js"
import { api } from "../api"

const [windowMaximized, setWindowMaximized] = createSignal(false)

api.onWindowMaximizedChanged(setWindowMaximized)

void api.getWindowMaximized().then(setWindowMaximized)

export { windowMaximized }
