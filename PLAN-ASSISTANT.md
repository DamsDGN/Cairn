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
- **M8 Stats usage abonnement OpenCode Go** : afficher la consommation (5 h glissantes / semaine /
  mois) dans la sidebar. Pas d'API officielle dédiée (upstream #31084, #40584) : l'endpoint public
  utilisé par les extensions tierces est `GET https://opencode.ai/zen/go/v1/usage` avec
  `Authorization: Bearer <clé>` (référence : paquet `pi-opencode-go-usage`). La clé vit dans
  `~/.local/share/opencode/auth.json` (`opencode-go.key` ; repli `opencode.key`, puis
  `OPENCODE_GO_API_KEY` / `OPENCODE_API_KEY` / `OPENCODE_ZEN_API_KEY`). Chemin :
  RPC IPC main-process fork (lire auth.json, appeler l'endpoint, cache ~60 s, retour null sur toute
  erreur pour cacher silencieusement la carte), exposé comme `platform.goUsage?()` optionnel, la
  sidebar interroge toutes les 5 min. Le fallback cookie console (`/console/api/go/status`) est
  volontairement non porté (cookie.__Host-console_session non accessible au renderer).
- **M9 Conversations audio** : utiliser les APIs voice expérimentales déjà présentes en amont
  (`packages/protocol/src/groups/voice.ts` : `voice.models`, `voice.session`, `voice.instructions`,
  côté serveur `packages/core/src/voice.ts`, moteurs realtime openai/xai/google). Sessions brokerées
  par le serveur : clé fournisseur stockée côté serveur OU session hébergée par la Console OpenCode
  (facturée Go). Pas d'UI voice en amont (seul le parsing de handoff iOS existe). Phases :
  1) bouton micro dans le composer + session realtime full-duplex WebRTC via `voice.session`
     (SDP offer renderer -> serveur -> answer), retour audio dans la conversation ;
  2) dictation push-to-talk (STT) si le temps réel ne suffit pas (nécessite alors une API
     transcription, absente en amont).
  Attention Electron : permission micro à gérer côté main (setPermissionRequestHandler) et
  permission media quand la session démarre.

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
