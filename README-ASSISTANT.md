# OpenCode Assistant (fork)

Fork d'OpenCode Desktop transformé en assistant de chat généraliste, façon Claude Desktop :
une fenêtre, une conversation, pas d'onglets. Basé sur `anomalyco/opencode` branche `dev`,
travail sur `sover/generalist`, publié sur `DamsDGN/opencode-assistant` (privé).

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

## Installation (Linux)

Release `v0.1.0` : https://github.com/DamsDGN/opencode-assistant/releases

- `opencode-desktop-linux-x86_64.AppImage` (nécessite libfuse2 : `sudo apt install libfuse2`,
  ou `./opencode-desktop-linux-x86_64.AppImage --appimage-extract && ./squashfs-root/AppRun`)
- `opencode-desktop-linux-amd64.deb` (installe `OpenCode Dev` + `/usr/bin/ai.opencode.desktop.dev`)

Windows et macOS : en cours (voir "Builds cross-plateformes" dans PLAN-ASSISTANT.md).

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

## Principes de fork

1. Diffs petits, groupés, modules additifs : rebase `origin/dev` régulier.
2. Le mode assistant s'appuie sur `platform.assistantDirectory` (champ optionnel), le répertoire
   Conversations reste un projet OpenCode standard côté serveur.
3. Fichiers fork : `packages/app/src/assistant/` (sidebar, sidebar-state, voice), `shell.tsx`,
   `titlebar.tsx` (conditionnels), i18n `en.ts`/`fr.ts`, `PLAN-ASSISTANT.md` et ce README à la racine.
4. Aucune modification de schéma de tabs ni d'API serveur.

## À faire

- Builds Windows (NSIS) et macOS (zip non signé), release `v0.1.1`.
- Shell produit (M5) : tray, quick capture, notifications, démarrage auto.
- Branding (M6) : nouveau nom et logo de l'application (à décider), appId, icônes, deep link.
