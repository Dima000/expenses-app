## Why

The web app currently ships a neutral grayscale palette (all shadcn tokens at
chroma 0) that was never intentionally designed — it's the default new-york
starter theme. We want a deliberate look. A theme has been generated on the
shadcn create tool (preset `b11iT9n23M`) covering both colors and fonts, and
shadcn now offers a first-class `apply` command to adopt a preset into an
existing project.

## What Changes

- Adopt the shadcn CLI in `web/` by adding the missing `components.json`
  marker. Everything else the CLI needs (`@` alias, `@/*` tsconfig paths,
  `cn()` in `@/lib/utils`, Tailwind v4 via `@tailwindcss/vite`, vendored
  new-york components) already exists — this is a marker file, not a rewrite.
- Apply preset `b11iT9n23M` (colors **and** fonts) to `src/index.css`,
  replacing the grayscale token set with the preset's palette and adding its
  `font-*` tokens / `@font-face` (expected Inter + JetBrains Mono).
- Preserve the app's hand-authored base layer that is not part of any preset:
  `@custom-variant dark`, the `* { border-color }` reset, and the `body`
  base rule. Dark-first stays the default boot state.

## Capabilities

### New Capabilities
- `web-theming`: how the web app's design tokens (color + typography) are
  defined, which palette is authoritative, how the shadcn CLI manages them,
  and the dark-first boot guarantee.

### Modified Capabilities
<!-- None. No existing capability's requirements change. -->

## Impact

- **New file**: `web/components.json`.
- **Rewritten**: `web/src/index.css` token block (`:root`, `.dark`,
  `@theme inline`) plus new font tokens/`@font-face`.
- **Deps**: `apply` may add font/animation helper packages (e.g.
  `tw-animate-css`) to `web/package.json`.
- **No component/logic changes** — colors resolve through existing CSS
  variables, so `components/ui/*` and app code are untouched.
- Visual regression surface: every screen. Requires an eyeball pass in the
  running app (dark primary; light as secondary).
