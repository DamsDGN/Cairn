# Plan fork : assistant généraliste type Claude Desktop

Base : `anomalyco/opencode` branche `dev` (dépôt clonné ici, branche de travail `sover/generalist`).
App transformée : OpenCode Desktop (Electron + SolidJS) en assistant de chat généraliste, multi-plateforme Linux/macOS/Windows.

## Objectif produit

Assistant de chat desktop pour non-développeurs : conversations accrochées à un répertoire par défaut,
personas, pièces jointes, connecteurs MCP, accès fichiers via outils avec approbation humaine,
multi-fournisseurs (intel local, OpenAI, Anthropic, vLLM Sover...).

## Principes de fork

1. Tout réutiliser (main process, AppInterface, UI kit), dévier au minimum : diffs petits, groupés, modules additifs.
2. Rebase `origin/dev` régulièrement (l'upstream bouge beaucoup, releaser quasi chaque semaine).
3. Pas de changement de schéma de tabs ni d'API serveur tant qu'un répertoire sentinelle suffit.
4. Les fichiers de plan et notes vivent à la racine du fork, jamais dans `packages/*`.

## Décisions d'architecture

- Le mode assistant repose sur un **répertoire Conversations** (le "projet par défaut") : sessions,
  `opencode.json` (personas, permissions, MCP), pièces jointes. Un répertoire projet OpenCode est
  déjà le conteneur de sessions ; pas besoin d'inventer une notion "sans projet".
- Source de vérité du répertoire assistant : bootstrap de fenêtre (chargé via argv preload, lu par
  le renderer avant IPC), persisté dans le settings store du main process.
  Défaut : `app.getPath("documents")` + `Conversations`.
- Transmission au render : champ optionnel `Platform.assistantDirectory`
  (`packages/app/src/runtime/platform/platform.tsx`), alimenté côté desktop
  (`packages/desktop/src/renderer/platform/index.ts`). Champ optionnel : rebase sans douleur, et le
  web app l'ignore.
- Personas et permissions de l'assistant : `opencode.json` dans le répertoire Conversations
  (config projet). Zéro code divergent pour le default agent, la config existe déjà.

## Jalons

- **M0 Toolchain (fait)** : clone complet, `bun install` (2150 paquets), build dev OK, app lancée,
  onboarding first launch validé sur Linux Wayland. Particularité Linux dev : `ELECTRON_DISABLE_SANDBOX=1`
  (le SUID sandbox exige un chown root, non possible sans sudo).
- **M1 Mode assistant (fait)** : plumbing bootstrap + platform ; écran de draft sans sélecteur projet/git
  quand le répertoire est le répertoire assistant ; bouton "+" d'onglet par défaut sur le répertoire
  assistant ; tips du draft adaptés. Résolution du répertoire ordonnée après la détection de premier
  lancement (sinon une install neuve est prise pour un upgrade) et adoption au montage du premier draft.
- **M2 Persona & permissions (fait)** : génération idempotente du `opencode.json` du répertoire
  Conversations (agent "Assistant" en défaut : read/edit autorisés dedans, websearch ok, webfetch et
  le reste à approuver). Validé via le serveur standalone + `GET /api/agent?location[directory]=...`
  : l'agent apparaît en tête de liste. Reste à polir quoi quévers : cacher Build/Plan/General du
  picker dans ce mode, tester l'écriture réelle depuis le chat.
- **M3 Connecteurs MCP (hérité fait, OAuth validé)** : l'écran Connecteurs de l'upstream
  (`settings.extensions`, atteint via le sidebar) gère déjà tout : liste/toggle des serveurs,
  `mcp.connect` puis sur `needs_auth` le flow OAuth (`integration.oauth.connect` + ouverture du
  navigateur système `platform.openExternal` + poll status, paste de code quand la méthode demande
  un code, `providers/connect/mcp.ts` + `controller.ts`; routes serveur /connect/oauth
  connect/status/complete/cancel). Validé live le 23/10 : `integration.oauth.connect` sur le
  connecteur n8n (mcp_10645a44802caf6a) retourne bien une URL d'autorisation n8n.sover.lan
  mode auto, exp 10 min ; attempt annulé après test (côté CLI, repli interactif : `opencode mcp
auth`). Le point clé : les serveurs MCP de la config user (n8n, postsdeck, runpod, qonto,
  pennylane, hf-mcp-server) sont listés globalement par `integration.list`, le toggle attire la
  cible sur le répertoire courant (le répertoire assistant) ; aucun fork nécessaire. Reste :
  UI d'ajout d'un nouveau serveur MCP distant dans le répertoire assistant si le path upstream ne
  suffit pas (mcp-dialog hérité devrait suffire), test visuel avec un vrai connecteur OAuth.
- **M4 Historique chat (partiel fait)** : sidebar fork `packages/app/src/assistant/sidebar.tsx`
  montée dans `shell.tsx` quand `assistantDirectory` existe (cachée en mobile et sous la surface
  réglages) : nouvelle conversation, historique (30 dernières du répertoire), recherche inline
  (debounce 150 ms, `session.list` search = LIKE titre côté serveur + filtre du merge local),
  projets (nouveau draft sur le worktree), artefacts (fichiers du répertoire, ouverture/reveal
  système), carte OpenCode Go (M8), raccourcis Connecteurs (`settings.open("extensions")`) et
  Réglages (`settings.open()`). Reste côté home : réorganisation chat-first et recherche de
  conversations à l'écran home, titre auto (existe déjà côté serveur : plugin Title au premier
  message ; vérifier qu'il tourne sur le répertoire assistant).
- **M5 Shell produit** : tray + menu contextuel, raccourci global quick capture, notifications,
  démarrage auto.
- **M6 Branding & distribution** : identité (appId, nom, icônes, deep link), signatures macOS
  (certificat Apple requis) et Windows, serveur d'auto-update. Packaging CI en place :
  Linux local (AppImage/deb, release `v0.1.0`), Windows NSIS + zip mac Apple Silicon via le
  workflow GitHub Actions (release `assistant-v0.1.1`, builds non signés). Reste : dmg, build mac
  Intel, signatures, nouveau nom/logo.
- **M7 Flavor Sover (optionnel)** : provider par défaut vers vLLM de Sover.tech.
- **M8 Stats usage abonnement OpenCode Go (fait)** : carte "OpenCode Go" dans la sidebar (histogramme
  des 3 fenêtres : 5 h / semaine / mois, poll 5 min). Endpoint `GET
https://opencode.ai/zen/go/v1/usage` (Bearer, ref paquet `pi-opencode-go-usage`), clé lue côté
  main-process depuis `~/.local/share/opencode/auth.json` (`opencode-go.key`, repli `opencode.key`,
  puis env `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`), cache 60 s, null sur
  toute erreur (carte absente). RPC IPC `GoUsage` + `platform.goUsage?()` optionnel (typecheck ok,
  tests desktop 131 pass). Vérifié live : 200 `{usage:{rolling/weekly/monthly:{status,percent,resetsAt}}}`,
  `resetsAt` ISO string converti en epoch ms. Restes éventuels : libellé reset countdown, couleur
  selon seuil, page réglages détaillée si souhaité (entry point product = sidebar ; à confirmer).
- **M9 Conversations audio (phase 1 faite, phase 2 en attente de clé)** : APIs voice expérimentales
  upstream utilisées (`voice.models` / `voice.session` / brokering serveur, moteurs realtime
  openai/xai/google). Fait : bouton micro dans la barre d'actions du composer (assistant uniquement),
  overlay Dialog (phases connect/listening/thinking/ready + transcripts user/assistant accumulés),
  session WebRTC via SDP offer/answer mise en forme par le serveur, canal data realtime
  OpenAI-family (speech started/stopped, transcription, deltas), permission `media` côté main,
  icône fork microphone, prop additive `voiceControl` sur Composer/ComposerEditor ; rebase-friendly.
  Constat du 23/10 : sur l'install de Damien, les 4 moteurs existent mais `available: false` (aucune
  clé openai/xai/google côté serveur, Console non connectée) : la voix ne démarre pas sans
  connecter OpenCode Console (hébergée, facturée Go) ou stocker une clé OpenAI en premier. Phase 2
  reste : instructions/persona lié à l'agent, moteurs websocket (grok/gemini), push-to-talk
  dictation (STT, absent upstream), interruption barge-in, UX plein écran Claude-like.
- **M10 Sidebar Claude Desktop (fait le 23/10)** : recadrage de la sidebar fork à la Claude Desktop,
  d'après les captures de référence (`/home/dams/Téléchargements/Claude Desktop/`) :
  - Ordre : `Nouvelle conversation` (bouton +), recherche inline, puis sections `Projets`,
    `Artefacts` et `Récents` (ex "Historique") en liste directe de conversations (30 dernières).
  - Sections `Projets` / `Artefacts` repliables (chevron), état persisté ; `Récents` ouverte par
    défaut, aussi repliable.
  - État centralisé dans `packages/app/src/assistant/sidebar-state.ts` : store Solid persisté en
    localStorage (largeur, collapse, sections). Règles repo respectées : `createStore` (pas de
    signals multiples), pas de try/catch (sections stockées en flags "0"/"1" par clé, pas de JSON).
  - Redimensionnement : `ResizeHandle` du UI kit sur le bord droit (200-480 px), collapse par drag
    sous 150 px (`collapseThreshold` + `onCollapse`), largeur persistée.
  - Collapse/expand via bouton icône `sidebar` dans la titlebar (tooltip i18n
    `assistant.sidebar.collapse` / `expand`), état persisté.
  - Onglets masqués en mode assistant : rail vertical (`shell.tsx`, `verticalTabs` conditionné à
    `!assistantRail()`) et strip horizontale + menu onglets récemment fermés (`titlebar.tsx`,
    fallback dans `<Show when={!assistantMode()}>`). `addSessionTab` dédoublonne déjà : cliquer une
    conversation Récents la réouvre, pas d'onglets fantômes.
  - i18n : `assistant.chats` = "Recents"/"Récents", nouvelles clés sidebar collapse/expand (en + fr).
  - Barre de titre épurée en mode assistant (flat, sur capture Claude Desktop) : ChannelIndicator
    ("dev"), WindowsAppMenu (burger) et le bouton Accueil masqués ; il reste l'icône panel
    (toggle sidebar) et le drag régional, tout le reste de la barre est vide.
  - Vérifié : `bun --bun run check` vert (lint + typecheck, 34 tasks), tests desktop 130 pass /
    1 skip / 0 fail, `bun run build` (electron-vite) OK. Commit `d2ca31fe9d` poussé sur GitHub main.
- **M11 Sidebar conversationnelle (refonte du 25/10, fait)** : la sidebar passe d'une liste plate à un
  vrai historique de chat.
  - En-tête marque (logo + wordmark serif Cairn), bouton `Nouvelle conversation` contrasté, recherche.
  - Conversations groupées par `Épinglés`, `Aujourd'hui`, `Hier`, `7 derniers jours`, `Plus
    anciennes` ; l'ordre reste `chats`, puis `Projets`, puis `Artefacts` repliables.
  - Ligne de conversation : renommage inline (Entrée valide, Échap annule), menu contextuel
    (`Renommer`, `Épingler`/`Détacher`, `Supprimer…`), dialogue de confirmation, indicateurs
    spinner (génération) et point accent (permission/formulaire en attente).
  - Épinglage persisté dans `opencode.assistant.sidebar.pinned` (`sidebar-state.ts`), nettoyé à la
    suppression ; navigation clavier native (boutons focusables, menu Kobalte).
  - États vides distincts (aucune conversation vs recherche sans résultat), i18n additive en/fr.
  - `SessionReviewToggle` masqué quand `platform.assistantDirectory` est défini : le panneau de revue
    git n'a pas sa place dans une conversation généraliste.
  - Vérifié : typecheck 0 erreur, `bun run test:unit` 764 pass / 0 fail, lint 0 erreur, captures
    Electron via CDP clair/sombre et parcours renommer/épingler/supprimer.

## Packaging Linux (validé le 23/10)

- Chaîne : `cd packages/desktop && bun ./scripts/prebuild.ts && bun run build` puis
  `bunx electron-builder --linux AppImage deb --config electron-builder.config.ts`. Le prebuild
  télécharge le CLI dev (`@opencode/cli-linux-x64-baseline@0.0.0-dev-21734`, 256 Mo) dans
  `resources/opencode-cli`, embarqué tel quel dans les artefacts (d'où la taille). rpm sauté sur
  cette machine : `rpmbuild` absent, pas de sudo pour l'installer, cible non demandée.
- Artefacts : `packages/desktop/dist/opencode-desktop-linux-x86_64.AppImage` (317 Mo) et
  `opencode-desktop-linux-amd64.deb` (255 Mo). Deb : Package `opencode-dev`, Version 2.1.4, Depends
  libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1,
  libsecret-1-0 ; postinst pose `/usr/bin/ai.opencode.desktop.dev` (update-alternatives) vers
  `/opt/OpenCode Dev/`, .desktop + metainfo installés. Structure vérifiée via `dpkg-deb -I/-c`,
  installation réelle non possible ici (pas de sudo) ; l'exécution équivaut à linux-unpacked,
  validée via l'AppImage extraite.
- AppImage : lancement direct impossible sans libfuse2 (Ubuntu 25.10 ne l'a plus) : côté utilisateur
  `sudo apt install libfuse2` ou `./x.AppImage --appimage-extract && ./squashfs-root/AppRun`.
  Testé extrait : démarrage réel OK (process main + zygote, CLI embarqué lancé en `serve --service`
  depuis `~/.config/ai.opencode.desktop.dev/cli/0.0.0-dev-21734-x64/`). Seuls warnings
  VA-API/Vulkan Wayland, non bloquants. Test effectué avec `ELECTRON_DISABLE_SANDBOX=1` (sandbox
  SUID non installable sans sudo ici ; sur un poste standard le sandbox fonctionne).
- Distribution GitHub : repo privé `DamsDGN/Cairn`, remote local `assistant`, branche
  `sover/generalist` poussée sur son `main`. Hook `pre-push` résolu localement : oxlint charge ses
  JS plugins via node, bloqué par node Ubuntu 22.22.1 (amaro absent : « Unknown file extension .ts »,
  « not compiled with TypeScript support »), alors que bun importe le TS nativement. Correction sans
  toucher upstream ni `--no-verify` : `.husky-local/pre-push` (exécutant `bun --bun run check`) +
  `git config core.hooksPath .husky-local`, `.husky-local/` exclu via `.git/info/exclude`.
  `check` passe (lint + typecheck turbo, 34 tasks OK), push effectif.
- Release : assets AppImage + deb attachés au tag `v0.1.0` du repo fork.

## Builds cross-plateformes (CI en place le 23/10)

- Tentative locale Windows : la chaîne passe jusqu'au `win-unpacked` complet (CLI win via
  `OPENCODE_CLI_TARGET=x86_64-pc-windows-msvc bun ./scripts/prebuild.ts` + renommage
  `resources/opencode-cli` en `.exe`, prébuild `@lydell/node-pty-win32-x64` copié dans
  `node_modules/@lydell/`, electron + asar + icônes + intégrité OK), mais l'étape NSIS finale
  exige `wine` : `spawn wine ENOENT`, pas de sudo pour l'installer. Verdict : packaging Windows
  non faisable en local sur cette machine.
- macOS en local : DMG impossible hors macOS (hdiutil), signature/notarize impossibles sans
  certificat Apple ; rester sur un zip non signé.
- Solution retenue : workflow GitHub Actions `.github/workflows/assistant-build.yml`
  (windows-latest pour le NSIS, macos-latest pour le zip mac via la config additive
  `electron-builder.assistant.ts`), déclenché par un tag `assistant-v*` ou manuellement
  (`workflow_dispatch`), release automatique des artefacts sur le tag.
- Tags : utiliser le préfixe `assistant-v*` (les centaines de tags `v*` upstream existent déjà dans
  le clone local, collision de noms).
- Prebuilds node-pty cross : installer via un temp dir puis copier dans
  `packages/desktop/node_modules/@lydell/` (`bun add --os=<os> --cpu=<cpu> @lydell/node-pty-<os>-<cpu>`
  dans un répertoire jetable), sans toucher au lockfile.
- Première release CI : `assistant-v0.1.1` (run 40021960512), sur tag `assistant-v0.1.1` ; Linux
  (AppImage + deb) rebuildé localement avec la sidebar M10 puis uploadé sur la même release :
  les 3 OS sont dans `assistant-v0.1.1` (boot AppImage revalidé).

## Risques

- Upstream très actif : chaque jalon doit rester un diff réduit. Les écrans modifiés sont les
  plus instables, rebaser tôt et souvent.
- Signature applicative : bloquant pour la distribution "propre" macOS/Windows, indépendant du code.
- Radars dev Linux connus : GPU sous Wayland, sandbox SUID (voir M0).
- Attention aux fichiers partagés (`packages/app`) : l'upstream les modifie en continu.

## Commandes dev

```sh
export PATH=$HOME/.bun/bin:$PATH
bun install                      # à la racine du monorepo
cd packages/desktop
ELECTRON_DISABLE_SANDBOX=1 bun dev
```

La première exécution d'onboarding crée `Documents/Projet par défaut` (comportement upstream).
