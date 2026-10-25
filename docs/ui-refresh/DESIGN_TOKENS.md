# Design tokens Cairn

Phase 2. Ce document fige la palette, la typographie et les tokens additifs de la marque Cairn. Il sert de référence pour les phases suivantes (layout, conversation, paramètres).

## Source

- Logo : `packages/app/public/assets/logo-cairn.svg`.
- Couleurs de départ : crème `#F5F3EC`, anthracite `#2B2A27`, pierre `#5B5852`, terre cuite `#C2562F`.
- Les valeurs finales sont des dérivés proches, ajustés pour atteindre les seuils WCAG AA sur les surfaces réelles.

## Thème

| Élément             | Valeur                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Fichier             | `packages/ui/src/theme/themes/cairn.json`                                                                                         |
| Identifiant         | `cairn`                                                                                                                           |
| Thème par défaut    | `packages/app/src/app.tsx`, prop `defaultTheme="cairn"`                                                                           |
| Préchargement       | `packages/app/public/oc-theme-preload.js`                                                                                         |
| Chargement immédiat | `packages/ui/src/theme/context.tsx` importe `cairn.json` comme `oc-2`, pour éviter un premier rendu avec les tokens upstream      |
| Fond de fenêtre     | dérivé de `--v2-background-bg-deep` dans `context.tsx`, plus fallback `#f7f4ec` / `#191816` dans `index.html` et le préchargement |

Le thème surcharge la rampe `v2-grey-*` complète et les rôles de texte et d'accent. Les autres rampes (états, diff, syntaxe) restent générées à partir des couleurs de base du thème.

## Palette claire

Fond de référence : `#F7F4EC` (`--v2-background-bg-base`).

| Rôle                   | Token                         | Valeur              | Contraste           |
| ---------------------- | ----------------------------- | ------------------- | ------------------- |
| Fond principal         | `--v2-background-bg-base`     | `#F7F4EC`           |                     |
| Fond profond (sidebar) | `--v2-background-bg-deep`     | `#F2EEE5`           |                     |
| Surface élevée         | `--v2-background-bg-layer-01` | `#EDE8DD`           |                     |
| Surface haute          | `--v2-background-bg-layer-02` | `#E4DFD3`           |                     |
| Texte principal        | `--v2-text-text-base`         | `#2B2A27`           | 13.06:1             |
| Texte secondaire       | `--v2-text-text-muted`        | `#5B5852`           | 6.45:1              |
| Texte tertiaire        | `--v2-text-text-faint`        | `#6E6960`           | 4.96:1              |
| Accent texte           | `--v2-text-text-accent`       | `#B04A28`           | 4.95:1              |
| Accent survol          | `--v2-text-text-accent-hover` | `#A94826`           | 5.25:1              |
| Fond accent            | `--v2-background-bg-accent`   | `#B04A28`           | blanc dessus 5.45:1 |
| Fond contrasté         | `--v2-background-bg-contrast` | `#2B2A27`           | texte clair 13.18:1 |
| Bordure                | `--v2-border-border-base`     | `rgba` alpha sombre |                     |
| Focus                  | `--v2-border-border-focus`    | `#B04A28`           |                     |
| Message utilisateur    | `--cairn-user-message-bg`     | `#EFE9DC`           | texte 11.86:1       |
| Code                   | `--cairn-code-bg`             | `#EFE9DC`           |                     |

## Palette sombre

Fond de référence : `#201E1B` (`--v2-background-bg-base`).

| Rôle                | Token                         | Valeur    | Contraste            |
| ------------------- | ----------------------------- | --------- | -------------------- |
| Fond principal      | `--v2-background-bg-base`     | `#201E1B` |                      |
| Fond profond        | `--v2-background-bg-deep`     | `#191816` |                      |
| Surface élevée      | `--v2-background-bg-layer-01` | `#3D3A35` |                      |
| Texte principal     | `--v2-text-text-base`         | `#ECEAE3` | 13.81:1              |
| Texte secondaire    | `--v2-text-text-muted`        | `#B8B2A6` | 7.88:1               |
| Texte tertiaire     | `--v2-text-text-faint`        | `#8C8679` | 4.59:1               |
| Accent texte        | `--v2-text-text-accent`       | `#E0805C` | 5.87:1               |
| Accent survol       | `--v2-text-text-accent-hover` | `#EDA28A` | 8.03:1               |
| Fond accent         | `--v2-background-bg-accent`   | `#C2562F` | blanc dessus 4.50:1  |
| Fond contrasté      | `--v2-background-bg-contrast` | `#ECEAE3` | texte sombre 13.81:1 |
| Focus               | `--v2-border-border-focus`    | `#E0805C` |                      |
| Message utilisateur | `--cairn-user-message-bg`     | `#2A2825` | texte 12.21:1        |
| Code                | `--cairn-code-bg`             | `#26241F` |                      |

Les ratios sont calculés selon WCAG 2.1 (luminance relative). Le seuil AA texte normal est 4.5:1, le seuil AA grand texte 3:1. Les bordures et séparateurs sont décoratifs, sans exigence de contraste.

## Typographie

| Usage                | Police                                   | Réglage                                      |
| -------------------- | ---------------------------------------- | -------------------------------------------- |
| Interface            | Inter (variable, embarquée)              | 13 px par défaut, 440                        |
| Lecture des réponses | Source Serif 4 Variable (OFL, embarquée) | 16 px, interligne 1.65, mesure 68 caractères |
| Code                 | IBM Plex Mono / JetBrainsMono Nerd Font  | 12 à 13 px                                   |

- Fichiers : `packages/app/public/assets/source-serif-4-{latin,latin-ext}-wght-{normal,italic}.woff2`.
- Déclaration : `packages/app/src/brand.css`, `@font-face` avec `font-display: swap`.
- Aucun CDN, aucun appel réseau.
- Classe de lecture : `.cairn-prose` (serif, mesure, `text-wrap: pretty`, titres équilibrés).
- Token : `--cairn-font-serif`.

## Rayons

| Token                    | Valeur | Usage                           |
| ------------------------ | ------ | ------------------------------- |
| `--cairn-radius-sm`      | 6 px   | petits contrôles, badges        |
| `--cairn-radius-control` | 8 px   | boutons, champs, sélecteurs     |
| `--cairn-radius-md`      | 10 px  | cartes compactes, blocs de code |
| `--cairn-radius-lg`      | 14 px  | cartes, messages utilisateur    |
| `--cairn-radius-xl`      | 20 px  | composer, dialogues             |

## Mouvement

| Token                   | Valeur                           |
| ----------------------- | -------------------------------- |
| `--cairn-duration-fast` | 120 ms                           |
| `--cairn-duration-base` | 180 ms                           |
| `--cairn-duration-slow` | 280 ms                           |
| `--cairn-ease-out`      | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

`prefers-reduced-motion: reduce` réduit animations et transitions à 0.01 ms et désactive le défilement animé.

## Contenu et focus

| Token                        | Valeur |
| ---------------------------- | ------ |
| `--cairn-content-width`      | 46 rem |
| `--cairn-content-width-wide` | 56 rem |
| `--cairn-prose-size`         | 16 px  |
| `--cairn-prose-leading`      | 1.65   |
| `--cairn-prose-measure`      | 68 ch  |

Le focus clavier utilise `--v2-border-border-focus` avec un anneau de 2 px et un décalage de 2 px. Les composants qui définissent déjà leur propre anneau gardent la priorité.

## Fichiers touchés

- `packages/ui/src/theme/themes/cairn.json` (nouveau)
- `packages/ui/src/theme/context.tsx` (import, map de noms, fond dérivé du token)
- `packages/app/src/app.tsx` (thème par défaut)
- `packages/app/public/oc-theme-preload.js` (défaut et fonds)
- `packages/app/src/theme-preload.test.ts` (attentes)
- `packages/app/index.html` (fallback de fond)
- `packages/app/src/brand.css` (nouveau, tokens et polices)
- `packages/app/src/index.css` (import de `brand.css`)
- `packages/app/src/design-system.stories.tsx` (nouveau banc d'essai)
- `packages/storybook/.storybook/preview.tsx` (thème par défaut)

## Vérifications

```sh
export PATH=$HOME/.bun/bin:$PATH
cd packages/ui && bun test src
cd packages/app && bun run test:unit
cd packages/ui && bun run typecheck
cd packages/app && bun run typecheck
```

Voir `THIRD_PARTY_LICENSES.md` pour la licence de la police serif.
