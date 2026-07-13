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
- [ ] 2.5 Commit `components.json` (+ deps init added: radix-ui, tw-animate-css,
      shadcn, @tabler/icons-react, @fontsource-variable/{noto,nunito}-sans)

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

- [ ] 5.1 `npm run build` (typecheck) passes in `web/`
- [ ] 5.2 Run the app; eyeball every screen in dark, then light — text contrast,
      borders, primary/accent buttons, dialogs, toasts, table, select
- [ ] 5.3 Confirm the new self-hosted fonts render (Noto Sans body); offline
      works via the existing PWA precache — no fallback expected

## 6. Ship

- [ ] 6.1 Push branch; open PR referencing this change; let CI go green
- [ ] 6.2 Note any preset-added deps/unused tokens in the PR description
- [ ] 6.3 Merge; archive this OpenSpec change
