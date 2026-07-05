# Project guidelines

## Workflow — work via pull requests
- Do **not** commit directly to `main`. For any change: create a short-lived
  branch, commit, push, and open a PR. Let CI run on the PR and merge once green.
  This keeps `main` releasable and avoids redundant CI runs.
- Branch naming: `feat/…`, `fix/…`, `chore/…` (no Jira project on this repo).

## Commits & PRs
- Commit messages start with a Jira ID, `nojira`, or `chore` (global convention).
- Do not mention AI/Claude in commit messages or PR descriptions.

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
