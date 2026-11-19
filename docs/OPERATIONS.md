# Authoritative operations checkpoint, 18 November 2026

- Public GitHub repository, production branch `master`. Do **not** merge stacked PRs without owner approval because Cloudflare may automatically deploy `master`.
- Preferred production host: **Cloudflare Pages**, Node 22, `npm ci && npm run build`, output `dist`; live URL and current deployment status not verified in this session.
- GitHub Actions validates TypeScript, Vitest, production build and Chromium Playwright. The redundant GitHub Pages publish job is removed in final hardening PR to avoid the earlier enablement failure and duplicate hosting.
- Current verified draft PRs: #10, #11, #12, #13, stacked in order. #13: 29 unit and 32 browser tests passed, including production cold offline launch.
- Local setup: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Production browser tests: `npm run build`, then `E2E_PRODUCTION=1 npm run test:e2e` (Bash; PowerShell: `$env:E2E_PRODUCTION='1'; npm run test:e2e`).
- Rollback: restore last working Cloudflare deployment and keep browser media caches/progress intact. Avoid site-data clearing, cache key changes or major schema migration without recovery planning.

The section below records the original scaffold plan and contains outdated statements about private repository access, missing lockfiles, CI, hosting and offline support. Treat this checkpoint and current code as authoritative.

---

# Local Development, CI, Release and Recovery Runbook

## Prerequisites
Node.js 22+, Git, a recent Chromium browser and editor. Supported baseline OS: Windows PowerShell and Linux shell. No cloud or paid API credentials are needed to run the initial scaffold.

## First run
~~~powershell
git clone https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library.git
cd Taiyous-Manga-Library
npm install
npm run typecheck
npm test
npm run build
npm run dev
~~~
Use the local URL printed by Vite. The catalogue is intentionally empty; this is expected. If a step fails, inspect the error and Node version; do not suppress type failures or remove tests to pass CI.

## Dependency lock and deterministic installation
At repository creation, no lockfile was committed. `npm install` generates `package-lock.json`. **Commit it in the first dependency-management PR**, then change CI to `npm ci`. Until then, CI uses `npm install --no-audit --no-fund` with pinned major/minor dependency ranges. Revisit advisories and lockfile integrity before any release. Never install uncontrolled latest packages in deployment.

## Branches and PRs
`master` is the authoritative planned release branch. Use `feature/<topic>` or `fix/<topic>` from latest master. Keep scope narrow. Include problem statement, exact files, threat/sync impact, tests, screenshots if UI changed and rollback. Avoid editing unrelated repositories. Do not force push master.

## CI and deployment
`.github/workflows/ci.yml` runs typecheck, tests and production build. It does **not** publish artifacts to a live app, connect to Hugging Face, or deploy Pages. A future Cloudflare Pages project requires explicit owner authorisation, environment separation, secrets stored server-side, an explicit manual production gate, restore plan and verified private media access.

## Configuration
The only reserved public config is `VITE_HUB_URL`. Vite exposes `VITE_*` values to browsers, so never store OAuth client secrets, private storage tokens or owner passwords there. Keep local secrets in excluded files and Cloudflare server-side secret storage after approval.

## Data and backup
No real catalogue store exists yet. Before adding one: specify schemaVersion, revision checks, backup/restore, offline fallback, cache eviction, storage quotas and import size limits. Test restores using synthetic data and document retention. No destructive bulk migration without owner sign-off.

## Rollback
For code: revert the PR or redeploy the last known good tested commit. For a future dataset migration: stop writes, verify an immutable pre-migration backup, restore in a disposable environment first, and then restore production with explicit owner approval. Never treat 'delete and recreate dataset' as recovery.

## Operational checklist
Check build, mobile accessibility, empty/error/offline states, CSP, provider quota/rate limits, private asset authorisation, logs redaction, cache versions, two-device conflict behaviour and any cost implications. Document actual results before claiming production readiness.


## 18 November 2026 execution environment limitation

The feature branch was developed through the authenticated GitHub connector. Local Node 22.16.0/npm 10.9.2 were available but `npm install` could not reach registry.npmjs.org (`EAI_AGAIN`), and no dependency packages existed in the npm cache (`ENOTCACHED`). The code was therefore **not** installed, typechecked, tested or built with its actual dependencies. The earlier GitHub Actions check returned no executed steps. `docs/DEVELOPMENT_REPORT_2026-11-18.md` contains exact evidence and subsequent verification commands. No lockfile was committed, so the `npm ci` switch is deliberately deferred rather than inventing a nonreproducible lockfile.

## Verified Actions-run acceptance checkpoint

On 18 November 2026 GitHub Actions on public repository branch `feature/local-manga-catalogue-reader` **passed** Node 22 `npm ci`, `npm run typecheck`, `npm test` (**19 tests**), `npm run build`, and `npm run test:e2e` (**12 Chromium tests**, 320/375/390/768/1280 px). Workflow: https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44327158478. The actual generated lockfile is committed. Prior notes about no lockfile and unexecuted checks are historical and superseded for this SHA.

A gated GitHub Pages demo is configured for successful pushes to `master`, using `--mode ghpages` to set the required path base. This is a **public synthetic-only preview**, not a private media deployment or authentication system. Its status and URL must be checked after the first successful deployment. Cloudflare Pages is separately prepared in `docs/DEPLOYMENT.md`, and remains unconnected until the owner links the GitHub repository.
