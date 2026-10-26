<p align="center">
  <picture>
    <img src="packages/app/public/assets/logo-cairn.svg" alt="Cairn" width="72">
  </picture>
</p>

<h1 align="center">Cairn</h1>

<p align="center">
  Un assistant de bureau pour le travail quotidien, bâti sur <a href="https://github.com/anomalyco/opencode">OpenCode</a>.
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

Cairn est un fork d'OpenCode Desktop transformé en assistant généraliste. Une fenêtre, une
conversation, pas de sélecteur de projet : tout vit dans un seul dossier `Conversations`, et
l'interface parle de discussions et de connecteurs plutôt que de dépôts et d'agents.

Il reprend le moteur, les fournisseurs et les outils d'OpenCode, et conserve sa licence MIT et ses
crédits.

## État

Alpha, `0.2.0`. Les builds Linux sont les plus testés. Les builds macOS et Windows ne sont pas
signés, le système demande donc une confirmation au premier lancement. Des aspérités sont à
attendre.

## Ce qu'il fait

- **Fenêtre centrée sur les conversations** : sidebar avec recherche, épinglage et suppression ; pas
  d'onglets.
- **Persona d'assistant** : un `opencode.json` généré dans le dossier `Conversations` définit
  l'agent par défaut, ses permissions et les modèles qu'il peut utiliser.
- **Connecteurs** : les serveurs MCP s'ajoutent et se retirent depuis les réglages, clés et OAuth
  compris.
- **Fournisseurs** : connecter n'importe quel endpoint compatible OpenAI depuis l'interface, et
  choisir le modèle sur lequel s'ouvrent les nouvelles conversations.
- **Voix locale** : Whisper tourne sur la machine, les modèles se téléchargent à la demande. La
  dictée écrit chaque phrase dans le composeur pendant que vous parlez, et la conversation vocale
  répond à voix haute avec une voix française embarquée.
- **Mises à jour** : les installations suivent les releases GitHub de ce dépôt.

## Installation

Releases : https://github.com/DamsDGN/Cairn/releases

Chaque release est produite par `.github/workflows/cairn-release.yml` à partir d'un tag `cairn-v*`.

- **Linux** : `.AppImage` et `.deb`.
- **Windows** : `.exe` NSIS. SmartScreen demande une confirmation : `Informations complémentaires`,
  puis `Exécuter quand même`.
- **macOS (Apple Silicon)** : `.zip`, non signé. Clic droit sur `Cairn.app`, puis `Ouvrir`, au
  premier lancement.

## Développement

Prérequis : Bun 1.4 et une machine Linux, macOS ou Windows avec une session graphique.

```sh
bun install
bun run --cwd packages/desktop dev
```

Sous Linux, le sandbox Electron exige un binaire aux droits root qu'un clone local n'a pas :

```sh
ELECTRON_DISABLE_SANDBOX=1 bun run --cwd packages/desktop dev
```

Packaging :

```sh
cd packages/desktop
bun ./scripts/prebuild.ts
bun run build
bunx electron-builder --linux AppImage deb --config electron-builder.config.ts
```

`packages/desktop` est la coque Electron, `packages/app` l'interface, `packages/core` le moteur.
L'essentiel du fork vit dans `packages/app/src/assistant` et dans le processus principal du desktop.

## Contribuer

Les pull requests sont bienvenues, en anglais. Lire [CONTRIBUTING.md](CONTRIBUTING.md) d'abord : il
couvre la CI, le style des commits et le processus de revue.

La branche par défaut est `main`. Le travail se fait sur des branches `sover/*`, fusionnées par une
pull request qui doit passer `cairn-ci`.

## Licence

MIT. Cairn repose sur OpenCode, par Anomaly Innovations ; la mention de copyright d'origine est
conservée dans [LICENSE](LICENSE) et les crédits OpenCode restent dans la page À propos.
