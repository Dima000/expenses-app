# web-theming Specification

## Purpose
TBD - created by archiving change adopt-shadcn-theme-preset. Update Purpose after archive.
## Requirements
### Requirement: shadcn CLI manages theme tokens

The web app SHALL be a shadcn-CLI-managed project so that theme presets can be
applied with `shadcn apply`. A `components.json` at `web/components.json` SHALL
describe the existing setup (new-york style, Tailwind v4, the `@` alias, and the
`@/components`, `@/components/ui`, `@/lib`, `@/lib/utils` locations) without
relocating or rewriting the already-vendored components.

#### Scenario: components.json reflects the existing layout

- **WHEN** the shadcn CLI reads `web/components.json`
- **THEN** it resolves the utils helper to `@/lib/utils`, the UI components to
  `@/components/ui`, and the global stylesheet to `src/index.css`, matching the
  paths the vendored components already import from

#### Scenario: Adding components.json does not move existing files

- **WHEN** `components.json` is introduced
- **THEN** no file under `web/src/components/ui/` is relocated, renamed, or
  regenerated as a side effect

### Requirement: Preset b11iT9n23M is the authoritative palette and typography

The web app's color tokens and font tokens SHALL be those of shadcn preset
`b11iT9n23M`, applied to `src/index.css` for both the light (`:root`) and dark
(`.dark`) token sets, including the preset's `font-*` tokens and any
accompanying `@font-face` declarations. The grayscale (chroma-0) starter
palette SHALL be fully replaced.

#### Scenario: Colors and fonts both come from the preset

- **WHEN** the theme is applied
- **THEN** `src/index.css` contains the preset's color values (not the chroma-0
  defaults) for `:root` and `.dark`, and the preset's font tokens are present
  and referenced by the `body` typography

#### Scenario: Tokens remain wired through @theme inline

- **WHEN** the preset is applied
- **THEN** every color token is still exposed as a Tailwind utility via the
  `@theme inline` mapping, so existing `bg-primary` / `text-foreground` / etc.
  class usages resolve without component edits

### Requirement: Preset fonts are self-hosted

The preset's font families (Nunito Sans, Noto Sans) SHALL be self-hosted via the
`@fontsource-variable/*` packages imported in `src/index.css`, and the `body`
typography SHALL resolve to them through the `--font-sans` token (no hard-coded
system-font override may shadow it). Self-hosting keeps the fonts same-origin so
the existing PWA precache serves them offline.

#### Scenario: Preset font applies to body text

- **WHEN** the app renders any text in `body`
- **THEN** it uses the preset's `--font-sans` family, not the system font stack

#### Scenario: Fonts available offline

- **WHEN** the app is loaded offline after being cached
- **THEN** the self-hosted font files are served from the PWA cache and the
  preset typography still renders

### Requirement: Dark-first base layer is preserved

Applying a preset SHALL NOT remove the app's hand-authored base layer. The
`@custom-variant dark` declaration, the `* { border-color: var(--color-border) }`
reset, and the `body` base rule SHALL survive, and dark SHALL remain the default
boot appearance.

#### Scenario: Base rules survive a preset apply

- **WHEN** a preset is applied to `src/index.css`
- **THEN** the `@custom-variant dark` line, the border-color reset, and the
  `body` background/foreground/antialiasing rules are still present afterward
  (re-added if the tool dropped them)

#### Scenario: App boots dark by default

- **WHEN** the app is loaded with no explicit theme preference
- **THEN** it renders using the `.dark` token set

