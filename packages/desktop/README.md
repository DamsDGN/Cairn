# Cairn desktop

The Electron shell of Cairn: window, IPC, sidecar service, packaging and updates.

## Development

```bash
bun install
bun dev
```

`bun dev` uses local renderer/server mode, the dev app identity (`tech.sover.cairn.dev`) and the CLI
source. On Linux the Electron sandbox needs a root-owned helper a checkout does not have:

```bash
ELECTRON_DISABLE_SANDBOX=1 bun dev
```

`bun dev --download-server <version>` downloads that CLI version instead.

## Build

Run `build` to produce the JS assets, then `package` to bundle the application. The result lands in
`dist/`.

```bash
bun run build && bun run package
```

Production builds need a prebuilt CLI distribution. The release workflow supplies it from the same
run:

```bash
OPENCODE_CHANNEL=prod OPENCODE_CLI_DIST=/absolute/path/to/packages/cli/dist bun run build
OPENCODE_CHANNEL=prod bun run package
```

Set `OPENCODE_CLI_TARGET` when packaging for another architecture. The CLI sits outside `app.asar`
in the application resources, and packaging fails when it is missing.

| Channel                                | Without `OPENCODE_CLI_DIST`    | With `OPENCODE_CLI_DIST`                      |
| -------------------------------------- | ------------------------------ | --------------------------------------------- |
| `dev`, `local`, unset, or unrecognized | Download the dev CLI           | Download the dev CLI; ignore the distribution |
| `beta`                                 | Download the beta CLI          | Copy the supplied CLI; fail if it is missing  |
| `prod`, `latest`                       | Fail before changing resources | Copy the supplied CLI; fail if it is missing  |

## Packaging and updates

`electron-builder.config.ts` holds the shared configuration: app ids `tech.sover.cairn` (`.dev`,
`.beta`), product names `Cairn`, `Cairn Dev`, `Cairn Beta`, artifacts `cairn-desktop-*`. Beta and
prod publish to the GitHub releases of `DamsDGN/Cairn` (`publish.provider: github`), never to the
upstream feed; that is what `app-update.yml` and the bundled updater read.

Releases come from tag `cairn-v<version>` on `main`, handled by
`.github/workflows/cairn-release.yml`.

## Startup benchmark

`bun run bench:startup` measures a **packaged** build from process spawn to the restored tab being
ready and the renderer idle, so dev-server and bundling costs are not part of the numbers.

```bash
OPENCODE_CHANNEL=dev bun run build && bunx electron-builder --win --dir --config electron-builder.config.ts
bun run bench:startup -- --runs 5                                  # warm service, reused by every launch
bun run bench:startup -- --runs 5 --compare dist/other/Cairn\ Dev.exe   # A/B: alternate two builds
bun run bench:startup -- --service cold                            # each launch spawns the service
bun run bench:startup -- --fresh                                   # first launch after an install
bun run bench:startup -- --profile-main --profile-renderer --trace # CPU profiles and a startup trace
```

The app runs in an isolated home with its own data and config directories, so it never attaches to
or restarts the developer's live service.

A packaged beta or prod build registers itself as the `opencode://` handler when it starts. That
scheme is kept from upstream because the console OAuth flow returns to it; only the protocol name
is Cairn's.
