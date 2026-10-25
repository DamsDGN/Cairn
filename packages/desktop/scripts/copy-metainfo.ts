import { resolveChannel } from "./utils"

const arg = process.argv[2]

const channel = arg === "dev" || arg === "beta" || arg === "prod" ? arg : resolveChannel()

const appId = channel === "prod" ? "tech.sover.cairn" : `tech.sover.cairn.${channel}`

const productName = channel === "prod" ? "Cairn" : `Cairn ${channel.charAt(0).toUpperCase() + channel.slice(1)}`

const summary = `Personal AI assistant${channel !== "prod" ? ` (${channel})` : ""}`

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${appId}</id>

  <metadata_license>CC0-1.0</metadata_license>
  <project_license>MIT</project_license>

  <name>${productName}</name>
  <summary>${summary}</summary>

  <developer id="tech.sover">
    <name>Sover.tech</name>
  </developer>

  <description>
    <p>
      Cairn is a personal assistant that works with your files and the tools you connect. It is built on OpenCode, the open source coding agent.
    </p>
  </description>

  <launchable type="desktop-id">${appId}.desktop</launchable>

  <content_rating type="oars-1.1" />

  <url type="homepage">https://sover.tech</url>
</component>
`

await Bun.write(`resources/${appId}.metainfo.xml`, xml)

console.log(`Generated metainfo for ${channel} at resources/${appId}.metainfo.xml`)
