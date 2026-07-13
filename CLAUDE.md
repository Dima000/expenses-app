# Project guidelines

## Workflow — work via pull requests
- Default to PRs: for any change, create a short-lived branch, commit, push,
  and open a PR. Let CI run on the PR and merge once green. This keeps `main`
  releasable and avoids redundant CI runs.
- Exception: small chores (docs, config tweaks, CI/tooling one-liners) may be
  committed directly to `main` without a PR.
- Branch naming: `feat/…`, `fix/…`, `chore/…`.

## Commits & PRs
- Track work via GitHub Issues / the GitHub Project. Use conventional-commit
  prefixes (`feat:`, `fix:`, `chore:`, `docs:`, …) and reference the relevant
  GitHub issue when one exists (e.g. `fix: … (#12)`).
- Claude attribution is welcome: commits may include a `Co-Authored-By: Claude`
  trailer and PR descriptions may mention Claude.

## CI
- Keep CI lean and fast: install + build (typecheck) + domain unit tests.
- The Firebase emulator suites are **not** in CI (they need a JVM + emulator boot).
  Run them locally: `npm run test:rules`, `npm run test:rest`.

## Secrets & env
- Never commit real env values. `web/.env.production`, `functions/.env.<project>`,
  and `functions/.secret.local` are gitignored — use the `.env.example` templates.
- The real REST secret lives only in Secret Manager, never in the repo.

## Deploy
- REST endpoint (`POST /spending`) is deployed but `invoker: 'private'` by choice;
  flip to `'public'` and redeploy to enable it. The web + voice app doesn't use it.
