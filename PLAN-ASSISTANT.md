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
- **M3 Connecteurs MCP** : écran géré en UI sur les APIs existantes `mcp.list/add/remove/connect`
  (`packages/server/src/handlers/mcp.ts`) et le dialog `mcp-dialog.tsx`.
- **M4 Historique chat (partiel fait)** : sidebar fork `packages/app/src/assistant/sidebar.tsx`
  montée dans `shell.tsx` quand `assistantDirectory` existe (cachée en mobile et sous la surface
  réglages) : nouvelle conversation, historique (30 dernières du répertoire), projets (nouveau draft
  sur le worktree), artefacts (fichiers du répertoire, ouverture/reveal système), raccourcis
  Connecteurs (`settings.open("extensions")`) et Réglages (`settings.open()`). Reste côté home :
  réorganisation chat-first et recherche de conversations, titre auto.
- **M5 Shell produit** : tray + menu contextuel, raccourci global quick capture, notifications,
  démarrage auto.
- **M6 Branding & distribution** : identité (appId, nom, icônes, deep link), packaging CI des 3
  plateformes (dmg, NSIS, deb), signatures macOS (certificat Apple requis) et Windows, serveur
  d'auto-update.
- **M7 Flavor Sover (optionnel)** : provider par défaut vers vLLM de Sover.tech.
- **M8 Stats usage abonnement OpenCode Go (fait)** : carte "OpenCode Go" dans la sidebar (histogramme
  des 3 fenêtres : 5 h / semaine / mois, poll 5 min). Endpoint `GET
https://opencode.ai/zen/go/v1/usage` (Bearer, ref paquet `pi-opencode-go-usage`), clé lue côté
  main-process depuis `~/.local/share/opencode/auth.json` (`opencode-go.key`, repli `opencode.key`,
  puis env `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`), cache 60 s, null sur
  toute erreur (carte absente). RPC IPC `GoUsage` + `platform.goUsage?()` optionnel (typecheck ok,
  tests desktop 131 pass). Vérifié live : 200 `{usage:{rolling/weekly/monthly:{status,percent,resetsAt}}}`,
  `resetsAt` ISO string converti en epoch ms.path Restes éventuels : libellé reset countdown, couleur
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
