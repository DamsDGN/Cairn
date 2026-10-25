import { homedir } from "node:os"
import path from "node:path"

export function autostartFile() {
  const config = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config")

  return path.join(config, "autostart", "cairn.desktop")
}

// The Exec field takes a command line, not a shell string: each argument is quoted on its own and
// the characters the spec reserves are backslash-escaped.
export function autostartEntry(command: string[]) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Cairn",
    "Comment=Cairn, a desktop chat assistant",
    `Exec=${command.map(quote).join(" ")}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n")
}

function quote(argument: string) {
  if (!/[^\w@%+=:,./-]/.test(argument)) return argument

  return `"${argument.replace(/(["\\$`])/g, "\\$1")}"`
}
