## 1. Branch & baseline

- [x] 1.1 Create branch `feat/shadcn-theme-preset` from `main`
- [x] 1.2 Snapshot the current `web/src/index.css` base layer to restore later:
      `@custom-variant dark`, `* { border-color }`, `body` rule

## 2. Wire the shadcn CLI

- [x] 2.1 From `web/`, run `npx shadcn@latest init` (needed `--base radix` and
      `--preset b11iT9n23M`; the CLI requires a preset at init, so init + apply
      collapsed into one step)
- [x] 2.2 Confirm `web/components.json` resolves utils→`@/lib/utils`,
      ui→`@/components/ui`, css→`src/index.css`, Tailwind v4 (style is the
      preset's `radix-luma` / olive base, not new-york — expected)
- [x] 2.3 Verify no `web/src/components/ui/*` file was moved/regenerated
      (init wrote a stray `web/@/lib/utils.ts`; removed it — real
      `src/lib/utils.ts` untouched)
- [x] 2.4 Review `git diff` for `vite.config.ts` / `tsconfig*.json`; ensure the
      `@` alias and `@/*` paths were not duplicated or broken (no changes)
- [x] 2.5 Committed `components.json` + deps + theme in one commit (init+apply
      were a single CLI step; deps: radix-ui, tw-animate-css, shadcn,
      @tabler/icons-react, @fontsource-variable/{noto,nunito}-sans)

## 3. Apply the preset (colors + fonts)

- [x] 3.1 Preset `b11iT9n23M` applied via init (see 2.1)
- [x] 3.2 Confirm `:root` and `.dark` now hold the preset palette (green/olive,
      not chroma-0); chart/sidebar/font tokens present
- [x] 3.3 Confirm every color token is still exposed via `@theme inline`
- [x] 3.4 Fonts are SELF-HOSTED (decision reversed from CDN): preset added
      `@fontsource-variable/noto-sans` + `nunito-sans` with `@import`s in
      `index.css`; same-origin so covered by the existing PWA `woff2` precache

## 4. Preserve the dark-first base layer

- [x] 4.1 `git diff web/src/index.css` — base layer survived; init kept
      `@custom-variant dark` + comment
- [x] 4.2 Reconcile duplicated base layer: init left the old plain
      `* {}` / `body {}` rules AND added an `@layer base` block. Removed the
      stale plain rules (the old `body` system-font stack was shadowing the
      preset font); kept antialiasing, let `html { @apply font-sans }` win
- [x] 4.3 Confirm the app still boots dark by default —
      `index.html` has `<html class="dark">`, untouched

## 5. Verify

- [x] 5.0 Prune unused `--base radix` extras: removed `shadcn`, `radix-ui`,
      `@tabler/icons-react` + the `@import "shadcn/tailwind.css"`; reset
      `iconLibrary` to `lucide`. Kept `tw-animate-css` + `@fontsource-variable/*`
- [x] 5.1 `npm run build` (typecheck) passes in `web/` (before and after prune;
      fonts still precached — 28 PWA entries)
- [x] 5.2 User reviewed the running app (dev server) and confirmed it looks
      good. Full per-screen eyeball limited by the Google-auth sign-in gate
      (unrelated to theming); dark-first boot + palette accepted
- [x] 5.3 Fonts wired: `body`→`--font-sans`→'Noto Sans Variable', woff2 bundled
      same-origin and precached (verified via build). Live render behind auth
      gate; token wiring confirmed in `index.css`

## 6. Ship

- [x] 6.1 Pushed branch; opened PR #11 (CI left running — not blocked on)
- [x] 6.2 Noted preset-added deps + prune in the PR description
- [x] 6.3 Archived this OpenSpec change (merge to main handled via PR #11)
