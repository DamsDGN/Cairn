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
- **M2 Persona & permissions (fait, picker et commandes filtrés le 25/10)** : génération idempotente
  du `opencode.json` du répertoire Conversations (agent "Assistant" en défaut : read/edit autorisés
  dedans, websearch ok, webfetch et le reste à approuver). Validé via le serveur standalone +
  `GET /api/agent?location[directory]=...` : l'agent apparaît en tête de liste. Le picker ne liste
  plus que les agents déclarés dans la configuration du dossier (`agents` + `default_agent` lus via
  `config.list`), donc Build/Plan/General n'apparaissent plus en mode assistant ; le menu slash
  masque `init`, `review` et `agent`, qui n'ont pas de sens dans un dossier sans dépôt, et garde
  `model` et `connect`. Vérifié live : picker à une seule entrée « Assistant », menu slash réduit à
  `/model` et `/connect`. Écart : le dock de permission n'a pas pu être déclenché en live, le quota
  des modèles gratuits était épuisé au moment du test ; le composant n'est pas modifié par le fork.
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
  cible sur le répertoire courant (le répertoire assistant) ; aucun fork nécessaire.
  Ajout depuis l'UI fait le 25/10 : bouton « Ajouter un serveur » dans Réglages > Extensions,
  dialog distant (URL) ou local (commande), nom validé `[a-zA-Z0-9_-]+`. Le main-process écrit
  l'entrée dans le `opencode.json` du dossier Conversations, puis un `mcp.add` runtime rend le
  serveur utilisable sans redémarrage. RPC `AssistantMcpAdd` / `AssistantMcpRemove`, logique pure
  testée dans `src/main/mcp-config.test.ts`. Écart assumé : pas de suppression par ligne dans l'UI,
  le switch existant ne fait que connecter/déconnecter ; le RPC de retrait est en place pour la
  suite. Vérifié live : dialog, sauvegarde fichier, row affichée. Reste : test avec un vrai
  connecteur OAuth ajouté depuis l'UI.
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
- **M6 Distribution (périmètre réduit le 25/10)** : identité Cairn faite (M13). Le build macOS et
  Windows (dmg, mac Intel, signatures, notarisation) sort du périmètre de ce fork : un collègue s'en
  charge. Reste ici uniquement ce qui touche la config partagée quand il en aura besoin, et le
  serveur d'auto-update, toujours non tranché (le bloc `publish` a été retiré pour qu'une install
  Cairn ne télécharge jamais un build OpenCode). Packaging CI en place : Linux local
  (AppImage/deb, release `v0.1.0`), workflow GitHub Actions pour Windows NSIS et zip mac Apple
  Silicon (release `assistant-v0.1.1`, builds non signés).
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
- **M12 Typographie et fenêtre sans cadre (25/10, fait)** :
  - Conversation en serif 16 px/1.65 sous `data-assistant="true"` (`brand.css`), Source Serif 4
    embarquée localement (OFL), titres serif, code mono, bulle utilisateur crème ; meta de réponse,
    tokens et coût masqués.
  - Recherche de la sidebar : `TextInput` du UI kit est figé à `width: 280px; flex: none` et
    débordait l'aside (drop à 290 px pour 264 px). Corrigé par `w-full` sur l'instance, sans toucher
    le composant partagé (surface coding intacte).
  - Linux : fenêtre `frame: false` (dev et fenêtre précoce), la titlebar in-app porte les contrôles
    réduire/maximiser/restaurer/fermer (28 px, tokens Cairn, hover neutre, fermer en rouge danger).
    RPC `WindowMinimize` / `WindowGetMaximized` / `WindowToggleMaximize` / `WindowClose`, événement
    `WindowMaximizedChanged` ; la barre reste zone de drag et les boutons en `no-drag`.
  - Écart assumé : en disposition d'onglets verticaux, la titlebar reste visible sur Linux (comme sur
    Windows) pour garder les contrôles accessibles.
  - Vérifié : typecheck app 1 592 fichiers et desktop 2 622 fichiers 0 erreur, tests app 764 pass,
    desktop 130 pass / 1 skip, lint 0 erreur, maximiser/restaurer live (1280x800 vers 1920x1200,
    libellé et icône restaurer qui suivent), `outerWidth == innerWidth` (plus de cadre natif).
- **M13 Identité Cairn (25/10, fait)** :
  - UI : wordmark OpenCode retiré de l'écran Nouvelle conversation en mode assistant, page À propos
    reconstruite autour du logo Cairn et de sover.tech (crédits OpenCode, mention MIT et trademark
    Anomaly conservés), écran Pairing et menu burger rebrandés, favicons et manifest web régénérés.
  - Identité : appId `tech.sover.cairn` (+ `.dev`, `.beta`), productName `Cairn` / `Cairn Dev` /
    `Cairn Beta`, artefacts `cairn-desktop-*`, paquets rpm `cairn` / `cairn-dev` / `cairn-beta`,
    metainfo Flathub-like régénéré (`tech.sover.cairn*.metainfo.xml`), titres de fenêtre Cairn.
  - Icônes : les 18 fichiers de chaque canal (PNG 16 à 1024, `icon.ico`, `icon.icns`) sont rendus
    depuis `logo-cairn.svg` à la taille exacte, sans rasteriseur système (rendu Playwright, conteneurs
    ICO et ICNS assemblés à la main).
  - Écarts assumés : le scheme `opencode://` est conservé (le retour OAuth du console le renvoie) et
    seul le nom du protocole devient Cairn ; le bloc `publish` d'electron-builder est retiré pour
    qu'une install Cairn ne télécharge jamais un build OpenCode en mise à jour ; l'`icon.icns` n'a pas
    l'inset Big Sur d'Image2Icon, le mark occupant toute la tuile.
  - Profils : l'appId change le répertoire de données, les profils dev existants ont été copiés vers
    `tech.sover.cairn.dev` (réglages, chats, brouillons, window state), vérifié live : thème Cairn,
    historique et `assistantDirectory` restaurés.
  - Vérifié : typecheck app 1 591 et desktop 2 621 fichiers 0 erreur, tests app 764 pass, desktop
    131 pass / 1 skip, config builder 7 pass, lint 0 erreur.
- **M14 Voix locale (à faire, décidé le 25/10)** : le mode vocal doit tourner sur le poste de
  l'utilisateur, pas sur l'infrastructure de Damien. Le setup atlas (speaches en CPU avec
  faster-whisper-large-v3-turbo et Kokoro-82M) sert de référence de qualité, pas de dépendance : un
  autre utilisateur de Cairn n'a ni atlas ni Tailscale.
  - Ce qu'il faut : un ASR et un TTS embarqués, CPU, hors ligne après le premier téléchargement des
    modèles (opt-in explicite avec la taille affichée, stockage dans le dossier de données).
  - Runtime candidat retenu : `sherpa-onnx-node` (2.0.0), qui couvre ASR, TTS et VAD avec des
    prebuilds npm par plateforme (`sherpa-onnx-linux-x64`, `-darwin-arm64`, `-win-x64`, etc.), donc
    pas de compilation chez l'utilisateur. Alternative : `@fugood/whisper.node` (whisper.cpp, même
    schéma de prebuilds par plateforme) pour l'ASR seul, avec le TTS système en repli.
  - Découpage : socle main (catalogue de modèles, téléchargement avec progression, stockage),
    transcription d'un buffer audio, synthèse, puis UI (dictée par bouton micro, lecture d'un
    message) et réglages Voix.
  - Contrainte packaging : la dépendance native doit être déclarée par plateforme dans
    `packages/desktop`, et les cibles Windows/macOS la reçoivent par les optionalDependencies, comme
    node-pty aujourd'hui. À signaler au collègue qui build ces cibles.
  - M9 phase 2 (voix hébergée temps réel) reste optionnelle : elle exige des clés OpenAI/xAI/Google
    ou la Console, ce qu'un utilisateur grand public n'a pas.

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

> Depuis le 25/10, le build macOS et Windows est délégué à un collègue : cette section reste comme
> référence des contraintes rencontrées, pas comme travail à reprendre ici.

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

## Ordre de travail (25/10)

1. M14 voix locale : socle main, STT puis TTS, UI dictée et lecture.
2. Reliquat M4 : titre auto sur le répertoire assistant, home chat-first.
3. M5 shell produit : tray, démarrage auto, notifications, quick capture.
4. Serveur d'auto-update Cairn, quand l'hébergement sera tranché.
5. Hors périmètre : build macOS/Windows et signatures (collègue), M9 phase 2 voix hébergée (clés),
   M7 (optionnel).

## Risques

- Upstream très actif : chaque jalon doit rester un diff réduit. Les écrans modifiés sont les
  plus instables, rebaser tôt et souvent.
- Signature applicative : hors périmètre de ce fork (délégué), bloquant seulement pour une
  distribution macOS/Windows "propre".
- Radars dev Linux connus : GPU sous Wayland, sandbox SUID (voir M0).
- E2E Playwright inutilisables sur cette machine : la version épinglée (1.60) ne supporte pas
  ubuntu 26.04 et les navigateurs de son cache ont disparu. Les vérifications live passent par CDP
  sur l'app Electron (`connectOverCDP`), les tests unitaires et les tests desktop.
- Attention aux fichiers partagés (`packages/app`) : l'upstream les modifie en continu.

## Commandes dev

```sh
export PATH=$HOME/.bun/bin:$PATH
bun install                      # à la racine du monorepo
cd packages/desktop
ELECTRON_DISABLE_SANDBOX=1 bun dev
```

La première exécution d'onboarding crée `Documents/Projet par défaut` (comportement upstream).
