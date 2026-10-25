# OpenCode Assistant (fork)

Fork d'OpenCode Desktop transformé en assistant de chat généraliste, façon Claude Desktop :
une fenêtre, une conversation, pas d'onglets. Basé sur `anomalyco/opencode` branche `dev`,
travail sur `sover/generalist`, publié sur [DamsDGN/Cairn](https://github.com/DamsDGN/Cairn).

Le plan complet et l'état des jalons vivent dans [PLAN-ASSISTANT.md](PLAN-ASSISTANT.md).

## Ce que fait ce fork

- Mode assistant : toutes les conversations vivent dans un répertoire `Conversations`
  (`Documents/Conversations` par défaut), sans sélection de projet à l'ouverture.
- Sidebar façon Claude Desktop : bouton `Nouvelle conversation`, recherche inline, sections
  `Projets`, `Artefacts` et `Récents` (liste directe des conversations), carte usage OpenCode Go,
  raccourcis Connecteurs et Réglages.
- Sidebar réductible (bouton dans la barre de titre) et redimensionnable (poignée sur le bord
  droit, 200-480 px, collapse par drag sous 150 px). État persisté en localStorage.
- Onglets masqués en mode assistant : cliquer une conversation de `Récents` l'ouvre directement
  (les onglets continuent de porter l'état en arrière-plan, ils ne sont juste pas visibles).
- Personas ("agents") configurés dans le `opencode.json` du répertoire Conversations.
- Connecteurs MCP : OAuth validé (n8n), gestion depuis Réglages > Connecteurs.
- Voix (phase 1) : bouton micro, session WebRTC realtime (OpenAI-family). Nécessite une clé
  OpenAI/xAI/Google ou OpenCode Console connectée.
- Statistiques d'usage OpenCode Go : fenêtres 5 h / semaine / mois, rafraîchies toutes les 5 min.

## Installation

Releases : https://github.com/DamsDGN/Cairn/releases

Les releases sont produites par GitHub Actions et publiées sur
[DamsDGN/Cairn releases](https://github.com/DamsDGN/Cairn/releases), à partir d'un tag
`cairn-v<version>` identique à la version de `packages/desktop/package.json`. Les builds ne sont pas
signés : SmartScreen et Gatekeeper demandent une confirmation à l'ouverture.

- **Linux** : `.AppImage` et `.deb` (`cairn` pour le canal prod).
- **Windows** : `.exe`, installeur NSIS (SmartScreen : `Informations complémentaires` puis
  `Exécuter quand même`).
- **macOS Apple Silicon** : `.zip`, app non signée (clic droit `Cairn.app` > `Ouvrir` au premier
  lancement). Pas de dmg, pas de build Intel.

Les trois systèmes sont buildés par `.github/workflows/cairn-release.yml`. Chaque release embarque
les fichiers `latest*.yml` et les `.blockmap` que lit la mise à jour intégrée.

## Développer

```sh
export PATH=$HOME/.bun/bin:$PATH
bun install                      # à la racine du monorepo
cd packages/desktop
ELECTRON_DISABLE_SANDBOX=1 bun dev
```

Vérifications avant de pousser (hook pre-push local, `.husky-local/`, non committé) :

```sh
bun --bun run check              # lint + typecheck (turbo, 34 tasks)
cd packages/desktop && bun run test
```

Packaging Linux :

```sh
cd packages/desktop
bun ./scripts/prebuild.ts        # télécharge le CLI dans resources/opencode-cli
bun run build                    # electron-vite (out/main, preload, renderer)
bunx electron-builder --linux AppImage deb --config electron-builder.config.ts
```

Cross-builds depuis Linux :

- Windows (NSIS) : la chaîne locale va jusqu'au `win-unpacked` complet (prébuild CLI win
  `OPENCODE_CLI_TARGET=x86_64-pc-windows-msvc bun ./scripts/prebuild.ts`, renommer
  `resources/opencode-cli` en `.exe`, prébuild node-pty win32 dans node_modules, `bunx
  electron-builder --win`), mais l'étape NSIS finale exige `wine` (absent ici, pas de sudo) :
  `spawn wine ENOENT`. Path retenu : le workflow GitHub Actions
  (`.github/workflows/cairn-release.yml`).
- macOS : pas de DMG hors macOS (hdiutil), pas de signature/notarize sans certificat Apple. Config
  additive `electron-builder.assistant.ts` : zip non signé, `sign: undefined`, `notarize: false`,
  prébuilds `@lydell/node-pty-darwin-arm64` requis dans node_modules. Lui aussi passé en CI
  (macos-latest).
- Workflow `cairn-release.yml` : déclenché par un tag `cairn-v*` ou manuellement. Un job `guard`
  vérifie que le tag correspond à la version de `packages/desktop/package.json`, puis trois jobs
  (ubuntu-latest, windows-latest, macos-latest) buildent et uploadent leurs artefacts, et un job
  `release` attache tout au tag GitHub. `electron-builder` reçoit `--publish never` : la release est
  créée par l'action, pas par electron-builder.
- Workflow `cairn-ci.yml` : lint, typecheck app et desktop, tests app et desktop sur chaque PR et
  sur les pushes de `main` et `sover/**`.
- Mise à jour intégrée : la GUI extension `updater` utilise `electron-updater` et lit le feed
  GitHub du fork (`publish: { provider: github, owner: DamsDGN, repo: Cairn }`). Une installation
  Cairn ne propose donc que des builds Cairn.
```

## Principes de fork

1. Diffs petits, groupés, modules additifs : rebase `origin/dev` régulier.
2. Le mode assistant s'appuie sur `platform.assistantDirectory` (champ optionnel), le répertoire
   Conversations reste un projet OpenCode standard côté serveur.
3. Fichiers fork : `packages/app/src/assistant/` (sidebar, sidebar-state, voice), `shell.tsx`,
   `titlebar.tsx` (conditionnels), i18n `en.ts`/`fr.ts`, `PLAN-ASSISTANT.md` et ce README à la racine.
4. Aucune modification de schéma de tabs ni d'API serveur.

## À faire

- Shell produit (M5) : tray, quick capture, notifications, démarrage auto.
- Voix locale (M14) : dictée et lecture sur la machine, modèles téléchargés à la demande.
- Distributions signées et build mac Intel : hors périmètre de ce dépôt, pris en charge séparément.
- Page Réglages > Modèles : aligner la liste sur le dossier Conversations, comme le sélecteur de
  modèle par défaut.
