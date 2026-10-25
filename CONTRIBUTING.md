# Contributing to Cairn

Thanks for taking the time. Cairn is a fork of OpenCode, so the engine, the tooling and most of the
interface come from upstream: small, focused changes are much easier to review and to keep across
upstream rebases.

## Language

Write pull requests, issues, commit messages, code comments and documentation in English. French is
fine in conversation with the maintainer, not in the repository.

## Before opening a pull request

- Open an issue first for anything that changes the product beyond a fix: a new screen, a new
  setting, a different default. Design happens before code.
- Branch from `main`, never commit to it directly. Use a descriptive branch, `sover/<topic>` for the
  maintainer's own work, `fix/<topic>` or `feat/<topic>` for contributions.
- Keep the change additive where possible. The fork is rebased on `anomalyco/opencode` regularly, and
  every touched shared file is a future conflict.

## Commit style

Conventional Commits, one logical change per commit:

```
feat(assistant): add MCP servers from the settings
fix(assistant): refresh the chat list after a deletion
docs: record the title bar milestone
```

The body explains why the change exists, not what the diff already shows.

## Checks

Every pull request runs `.github/workflows/cairn-ci.yml`:

```sh
bun install
bun run lint
bun run --cwd packages/app check --no-script -b
bun run --cwd packages/desktop check --no-script -b
bun run --cwd packages/app run test:unit
bun run --cwd packages/desktop test
```

Run the same commands locally before pushing. On Linux, `bun run lint` needs Bun on the `PATH`.

## Architecture in one minute

- `packages/desktop`: Electron main process, window, packaging, IPC.
- `packages/app`: the SolidJS interface.
- `packages/core`: the engine, providers, sessions, tools.
- `packages/app/src/assistant`: the fork's sidebar and assistant-specific screens.
- `PLAN-ASSISTANT.md`: milestones and decisions of the fork.

The assistant mode is driven by `platform.assistantDirectory`. When it is set, the window opens on a
chat instead of a project, and a few coding surfaces are hidden.

## Releases

Maintainers run the `cairn-release` workflow from the Actions tab and give it the version to publish,
for example `0.2.2`. The workflow writes that version to `packages/desktop/package.json`, commits it,
tags `cairn-v<version>`, builds Linux, Windows and macOS, and publishes the release with the files the
updater reads and notes generated from the merged pull requests. Do not bump the version in a pull
request.

The workflow pushes the version commit to `main`, which the repository rule protects. Store a classic
personal access token with the `public_repo` scope as the `RELEASE_TOKEN` secret, and add the
repository administrator role to the bypass list of that rule: the default `GITHUB_TOKEN` cannot
bypass it. A run that fails after the commit is safe to retry, because the preparation step skips
the commit and only recreates a missing tag.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
