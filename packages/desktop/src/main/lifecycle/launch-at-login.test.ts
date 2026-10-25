import { expect, test } from "bun:test"
import { autostartEntry } from "./autostart"

test("writes a freedesktop autostart entry that starts the app without a terminal", () => {
  const entry = autostartEntry(["/opt/Cairn/tech.sover.cairn"])

  expect(entry).toContain("[Desktop Entry]")
  expect(entry).toContain("Type=Application")
  expect(entry).toContain("Name=Cairn")
  expect(entry).toContain("Exec=/opt/Cairn/tech.sover.cairn")
  expect(entry).toContain("Terminal=false")
  expect(entry.endsWith("\n")).toBe(true)
})

test.each([
  { name: "quotes an argument with a space", command: ["/home/a b/Cairn/cairn"], exec: 'Exec="/home/a b/Cairn/cairn"' },
  {
    name: "quotes each argument of a dev command",
    command: ["/usr/bin/electron", "/home/a b/app"],
    exec: 'Exec=/usr/bin/electron "/home/a b/app"',
  },
  { name: "escapes a quote inside an argument", command: ['/home/a"b'], exec: 'Exec="/home/a\\"b"' },
])("$name", ({ command, exec }) => {
  expect(autostartEntry(command)).toContain(exec)
})
