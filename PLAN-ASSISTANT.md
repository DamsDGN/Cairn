# Cairn roadmap

Cairn turns OpenCode Desktop into a general-purpose assistant: one window, one conversation, no
project picker. This document records the milestones and the decisions behind them. It is the
reference for contributors; the user-facing description lives in `README.md`.

## Principles

- The fork stays small. Upstream is rebased regularly, so every touched shared file is a future
  conflict. Prefer additive files and conditional branches behind `platform.assistantDirectory`.
- No new server API when a desktop IPC call can write the same file the server already reads.
- The product speaks about chats, connectors and models, not repositories and agents.
- No telemetry, no remote fonts, no CDN. Fonts ship in the bundle.

## Milestones

- **M0 Toolchain (done)**: full clone, `bun install`, dev build, first-launch onboarding on Linux
  Wayland. Linux dev needs `ELECTRON_DISABLE_SANDBOX=1` because the SUID sandbox requires a
  root-owned helper.
- **M1 Assistant mode (done)**: bootstrap and platform plumbing. A draft opens on the assistant
  directory, without project or git selectors, and the new-tab button targets that directory.
- **M2 Persona and permissions (done)**: an idempotent `opencode.json` in the Conversations folder
  defines the default agent: read and edit allowed inside the folder, web search allowed, everything
  else asks. The agent picker lists only the agents declared in that file, and the slash menu hides
  `init`, `review` and `agent`.
- **M3 MCP connectors (done)**: the upstream Connectors screen handles OAuth. Servers can be added
  and removed from the settings; both writes target the Conversations `opencode.json`, and the
  runtime is updated without a restart. Removal is offered only for servers that file declares.
- **M4 Conversation history (done)**: the fork sidebar lists chats, with search, pinning and
  deletion. The Home screen stays chat-first: a centred composer and suggestions.
- **M5 Product shell (todo)**: tray and context menu, launch at login, system notifications, global
  quick capture.
- **M6 Distribution (done, shared)**: app id, product name, icons, deep link, GitHub releases and
  the updater feed. macOS and Windows signing, the dmg and the Intel build are handled outside this
  repository.
- **M7 Sover flavor (optional)**: default provider pointing at a self-hosted vLLM.
- **M8 Subscription usage (done)**: an OpenCode Go card in the sidebar, with the 5-hour, weekly and
  monthly windows, polled every 5 minutes from the public usage endpoint.
- **M9 Hosted voice (phase 1 done, phase 2 optional)**: the upstream realtime voice API behind a
  microphone button. It needs an OpenAI, xAI or Google key, or a connected console, so it stays out
  of the default path.
- **M10 Sidebar (done)**: the fork sidebar follows a desktop-assistant layout rather than a coding
  IDE, with a collapsing rail and a resize handle.
- **M11 Conversational sidebar (done)**: pinned and recent sections, inline search, artefacts,
  connectors and settings shortcuts.
- **M12 Typography and frameless window (done)**: serif conversation text with an embedded Source
  Serif 4, and a Linux frameless window whose title bar is drawn in-app with its own controls.
- **M13 Cairn identity (done)**: interface rebrand, About page, icons rendered from the mark at
  their exact sizes, packaging identity, favicons and web manifest.
- **M14 Local voice (in progress)**: speech recognition and synthesis on the user's machine, CPU
  only, models downloaded on request. `@fugood/whisper.node` provides prebuilt whisper.cpp binaries
  for every desktop platform, so nothing compiles on the user's machine. The main-process side
  (model catalogue, verified download, transcription) is done; the recording interface, the model
  download screen and read-aloud are still missing. Release builds keep only the CPU addon of
  the packaged platform: the CUDA and Vulkan variants would add 240 MB to every installer.

## Decisions

- `platform.assistantDirectory` drives the whole mode. When it is absent, the project-based flow is
  untouched.
- Assistant configuration lives in the assistant folder, not in the user-level config: it survives
  in the repository of chats the user can inspect.
- Provider keys are written as active credentials through the runtime API, because the engine reads
  the credential store, not `auth.json`.
- The deep link scheme stays `opencode://`: the console OAuth flow returns to it.
- Packaging publishes to `DamsDGN/Cairn` releases only. Pointing the updater at the upstream feed
  would offer OpenCode builds over a Cairn install.
- Speech models are downloaded on demand with their size shown, never bundled.

## Assumed deviations

- The macOS icon has no Big Sur inset; the mark fills the tile.
- macOS builds are unsigned, so the updater cannot install on that platform until they are signed.
- Conversation with the maintainer happens in French; repository text is English.

## Risks

- Upstream is very active. Rebase often and keep each milestone a small diff.
- Shared files under `packages/app` change constantly; prefer additive modules.
- The Android, TUI and server packages still target upstream products and are not maintained here.

## Development commands

```sh
export PATH="$HOME/.bun/bin:$PATH"
bun install
cd packages/desktop
ELECTRON_DISABLE_SANDBOX=1 bun dev
```

Checks:

```sh
bun run lint
bun run --cwd packages/app check --no-script -b
bun run --cwd packages/desktop check --no-script -b
bun run --cwd packages/app run test:unit
bun run --cwd packages/desktop test
```
