## Context

`web/` is a fully-built Vite + React + Tailwind v4 app using hand-vendored
shadcn (new-york) components. Theming lives entirely in `src/index.css` as oklch
CSS variables (`:root` + `.dark`) mapped to Tailwind utilities via
`@theme inline`. Everything the shadcn CLI needs is already in place — `@` alias
(`vite.config.ts`), `@/*` paths (`tsconfig.app.json`), `cn()` (`@/lib/utils`),
Tailwind v4 via `@tailwindcss/vite` — except the `components.json` marker.

The target theme is shadcn preset `b11iT9n23M`, generated at
`ui.shadcn.com/create`. It is **not** resolvable as a static registry URL
(`ui.shadcn.com/r/...` returns the SPA 404 shell; the tweakcn `/r/themes/<id>`
route 500s for these short IDs). Only the shadcn CLI resolves it, so we adopt it
through the CLI rather than by fetching JSON ourselves.

## Goals / Non-Goals

**Goals:**
- Make `web/` a shadcn-CLI-managed project (add `components.json`).
- Apply preset `b11iT9n23M` colors + fonts to `src/index.css`.
- Preserve the dark-first base layer and dark-by-default boot.

**Non-Goals:**
- No redesign of layouts or components beyond token-driven recoloring.
- No light-mode boot rework (dark stays default — confirmed acceptable).
- No adoption of preset extras the app doesn't use as a deliberate feature
  (e.g. `--chart-*`, `--sidebar-*` may land from the preset but nothing depends
  on them).

## Decisions

- **`apply`, not `init --template`.** `shadcn apply` is purpose-built to "apply
  a preset to an existing project"; `init --template vite` scaffolds a *new*
  project and would fight the existing app. `apply` defaults its cwd to `web/`,
  which is correct.
- **`init` once, first — for the marker only.** `apply` reads `components.json`
  for paths/aliases, which we lack. Running `shadcn init` in an
  already-configured Tailwind-v4 project effectively just writes
  `components.json`. Alternative considered: hand-write `components.json`.
  Rejected as more error-prone than letting the CLI detect the setup, but it's
  the fallback if `init` tries to over-rewrite.
- **Take colors + fonts** (run `apply` without `--only`), per the decision to
  adopt the preset's typography (expected Inter + JetBrains Mono) alongside the
  palette.
- **Fonts self-hosted (as the preset ships them).** The preset installs its
  families (Nunito Sans, Noto Sans) as `@fontsource-variable/*` npm packages and
  `@import`s them in `index.css` — same-origin, so the existing PWA `woff2`
  precache serves them offline with no `runtimeCaching` rule needed. This
  reverses the earlier CDN plan: CDN was chosen before we knew the preset
  self-hosts, and self-hosting removes the offline-fallback downside entirely.
  One required fixup: the pre-existing `body { font-family: <system stack> }`
  rule was overriding the preset font, so it was removed in favor of
  `html { @apply font-sans }`.
- **Preserve the base layer by diff-and-restore.** `apply` rewrites the token
  block in place and may drop the hand-authored `@custom-variant dark`, border
  reset, and `body` rule. We review `git diff src/index.css` and re-add any
  dropped lines rather than trusting the tool to keep them.

- **Trim the `--base radix` extras the app doesn't use.** `init --base radix`
  pulled in `shadcn` (runtime dep, for `@import "shadcn/tailwind.css"`),
  `radix-ui` (unified package), and `@tabler/icons-react`. Verified none are
  used: the vendored components import individual `@radix-ui/react-*`, use
  classic `data-[state=…]` arbitrary variants (not the `data-open` custom
  variants `shadcn/tailwind.css` provides), have no accordion, and use lucide
  icons. Removed all three deps + the import, and reset `components.json`
  `iconLibrary` to `lucide`. Kept `tw-animate-css` (dialog/select/toast
  reference `animate-in`) and the two `@fontsource-variable/*` font packages.

## Risks / Trade-offs

- [Preset fails to resolve mid-run] → Clean git tree; `apply` runs after `init`,
  so a failed `apply` leaves only `components.json` + deps to review or revert.
- [`init` over-rewrites index.css / config] → Do `init` and `apply` as separate
  commits (or inspect the working tree between them) so each diff is legible;
  revert and hand-write `components.json` if `init` clobbers too much.
- [Font swap changes layout/metrics] → Eyeball pass in the running app; fonts
  are the most visible non-color change.
- [Preset adds unused tokens/deps] → Cosmetic bloat only; acceptable. Note any
  new package in the PR description.

## Migration Plan

1. Branch `feat/shadcn-theme-preset`.
2. `cd web && npx shadcn@latest init` → commit `components.json` (+ any deps).
3. `npx shadcn@latest apply --preset b11iT9n23M` (colors + fonts).
4. `git diff src/index.css`; restore dropped base-layer rules.
5. Build/typecheck; run the app; verify dark (default) then light.
6. PR; merge on green (per repo PR workflow).

Rollback: revert the branch/PR — theme is isolated to `components.json`,
`src/index.css`, and `package.json`.

## Open Questions

- Does `init` over-rewrite `src/index.css` / `vite.config.ts` / `tsconfig*`
  beyond adding `components.json`? Unknown until run — inspect the diff between
  the `init` and `apply` commits; fall back to hand-writing `components.json`
  if `init` clobbers too much. (No decision needed up front.)
- Does `apply` require a network round-trip that could rate-limit in CI? (CI
  only builds/typechecks; theme apply is a local dev step, so likely N/A.)
