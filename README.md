<p align="center">
  <picture>
    <img src="packages/app/public/assets/logo-cairn.svg" alt="Cairn" width="72">
  </picture>
</p>

<h1 align="center">Cairn</h1>

<p align="center">
  A desktop chat assistant for everyday work, built on <a href="https://github.com/anomalyco/opencode">OpenCode</a>.
</p>

<p align="center">
  <a href="README.fr.md">Français</a>
</p>

Cairn is a fork of OpenCode Desktop turned into a general-purpose assistant. One window, one
conversation, no project picker: everything lives in a single `Conversations` folder, and the
interface speaks about chats and connectors rather than repositories and agents.

It inherits OpenCode's engine, providers and tooling, and keeps its MIT license and credits.

## Status

Early alpha, `0.2.0`. Linux builds are the most tested. macOS and Windows builds are unsigned, so
the system asks for confirmation on first launch. Expect rough edges.

## What it does

- **Chat-first window**: a conversation sidebar with search, pinning and deletion; no tabs.
- **Assistant persona**: a seeded `opencode.json` in the `Conversations` folder defines the default
  agent, its permissions and the models it may use.
- **Connectors**: MCP servers can be added and removed from the settings, with keys and OAuth.
- **Providers**: connect any OpenAI-compatible endpoint from the interface, and pick the model new
  conversations start on.
- **Local speech**: Whisper runs on the machine, models are downloaded on demand. Dictation writes
  each sentence into the composer while you speak, and the voice conversation answers out loud with
  an embedded French voice.
- **Updates**: installed builds check the GitHub releases of this repository.

## Install

Releases: https://github.com/DamsDGN/Cairn/releases

Each release is produced by the `cairn-release` workflow: it bumps the version, tags it, builds the
installers and writes the release notes.

- **Linux**: `.AppImage` and `.deb`.
- **Windows**: NSIS `.exe`. SmartScreen asks for confirmation: `More info`, then `Run anyway`.
- **macOS (Apple Silicon)**: `.zip`, unsigned. Right-click `Cairn.app`, then `Open`, on first launch.

## Development

Requirements: Bun 1.4 and a Linux, macOS or Windows machine with a desktop session.

```sh
bun install
bun run --cwd packages/desktop dev
```

On Linux, the Electron sandbox needs a root-owned helper that a local checkout does not have:

```sh
ELECTRON_DISABLE_SANDBOX=1 bun run --cwd packages/desktop dev
```

Packaging:

```sh
cd packages/desktop
bun ./scripts/prebuild.ts
bun run build
bunx electron-builder --linux AppImage deb --config electron-builder.config.ts
```

`packages/desktop` is the Electron shell, `packages/app` the interface, `packages/core` the engine.
Most of the fork lives in `packages/app/src/assistant` and in the desktop main process.

## Contributing

Pull requests are welcome, in English. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: it covers the
CI, the commit style and the review process.

The default branch is `main`. Work happens on `sover/*` branches, merged through a pull request that
must pass `cairn-ci`.

## License

MIT. Cairn is based on OpenCode by Anomaly Innovations; the original copyright notice is kept in
[LICENSE](LICENSE) and the OpenCode credits remain in the About page.
