# Taiyou's Manga Library

> **Public, fictional-data demonstration.** Production `master` remains at `6a6e337` until the owner approves deployment. Cloudflare Pages is the intended host; live deployment has not been independently verified.
>
> **Verified feature PRs (stacked, unmerged):** [#10 mobile reader](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/10), [#11 browser navigation](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/11), [#12 local progress](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/12), [#13 synthetic offline reading](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/13). PR #13 passed 29 unit and 32 production-browser tests. Final hardening is staged separately.
>
> **Never upload real manga images or credentials to public Git.** Private Hugging Face storage, authentication and cross-device progress are not connected.

## Mission
Read and organise legitimately acquired manga with chapter/page-level progress and optional offline access. The user experience should remain readable, fast, polished and accessible on phones, tablets and desktop. The existing novel library is the visual inspiration, not an implementation dependency.

## Place in the five-repository ecosystem
- [Shared Core and parent Personal Hub](https://github.com/AdityaSreevatsaK/Taiyous-Shared-Core): experimental common contracts, presentation pieces and navigation. **Not a mandatory network dependency.**
- [Novel Library](https://github.com/AdityaSreevatsaK/Taiyous-Personal-Library): existing production EPUB app. It must not be modified by this repo's agents.
- **This repo:** owns manga-specific models, local UX, future storage adapter and future release pipeline.
- Other modules remain independently versioned and deployed.

## Quick start (Node.js 22+)
1. Clone this public repository and open it in your editor.
2. Run `npm ci` to install dependencies from the committed lockfile.
3. Run `npm run dev` and open the Vite URL displayed in the terminal (normally http://127.0.0.1:5173).
4. Run `npm run typecheck`, `npm test`, and `npm run build`.
5. Review [AGENTS.md](AGENTS.md) and [the session handover](docs/SESSION_HANDOVER_PROMPT.md) before feature development.

## Current scaffold
```text
src/
  domain/types.ts         Domain-specific interfaces
  domain/search.ts        Pure local title/alias search
  domain/search.test.ts   Synthetic, offline tests
  data/catalogue.ts      Deliberately empty catalogue
  App.tsx                 Honest starter page and catalogue view
  styles.css              Responsive design foundations
.github/workflows/ci.yml  Typecheck / tests / build; no deployment
docs/                     Architecture, contracts, threat model, operations and agent handover
```

Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.

## Non-negotiable boundaries
- The owner has authorised public repository source visibility. Verify the actual GitHub setting before asserting that the change is live. No personal media or private credentials may be added to Git.
- No real private media or credentials in Git, browser bundles, test fixtures or GitHub Actions logs.
- No unapproved automatic production deployment. New code is developed on short-lived branches and reviewed through pull requests.
- No cross-app single sign-on promises. The deployed Novel Library's Hugging Face OAuth cookie cannot simply authenticate unrelated app origins.
- No copied entire Novel Library, no Git submodules, no premature shared database.
- No unlicensed manga downloads, paywall bypass, scraping of protected sites, reader requests to arbitrary URLs, or remote image proxying without SSRF protection.

## Read these in order
1. [Agent working agreement](AGENTS.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Data contract](docs/DATA_CONTRACTS.md)
4. [Security](docs/SECURITY.md)
5. [Integration](docs/INTEGRATION.md)
6. [Design standards](docs/DESIGN_SYSTEM.md)
7. [Development and CI](docs/OPERATIONS.md)
8. [Verification matrix](docs/TESTING.md)
9. [Roadmap and acceptance](docs/ROADMAP.md)
10. [Decision log](docs/DECISIONS.md)
11. [GitHub metadata/settings](docs/REPOSITORY_SETTINGS.md)
12. [Copyable agent handover](docs/SESSION_HANDOVER_PROMPT.md)

## Status statement
Scaffold committed, domain adapters **not connected**, no external providers and no active production URL. Work remaining is documented rather than silently treated as done. 


## Fixture reader development (18 November 2026)

The `feature/local-manga-catalogue-reader` branch adds a fully fictional demonstration separate from an **empty** private collection. It uses CSS cover studies and locally generated abstract PNG page illustrations, not real manga assets. The demo's rating, tags and collections are synthetic and safe to include in public source code. The reader has in-session page resume, keyboard/touch navigation, one-page-ahead preloading, an offline indicator, honest no-data/error states and no external media URL requests. Vertical mode currently steps one page at a time rather than providing continuous scroll.

This is **not** proof of production readiness. See [development/verification report](docs/DEVELOPMENT_REPORT_2026-11-18.md), [source-rights/private adapter proposal](docs/adr/006-manga-rights-and-private-asset-adapter.md) and [potential Shared Core components](docs/SHARED_CORE_RFC_001.md). The code has **not** had an online npm install, reliable typecheck, Vitest, Vite build or responsive browser run in this environment.

### Quick test once npm and GitHub Actions execution are restored

```bash
npm install --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run dev
```

After the online install, inspect and commit a *genuine* `package-lock.json`, then replace the CI install step with `npm ci`. Do not commit an empty/offline-generated lockfile.

### Repository visibility and content privacy

On 18 November 2026 the owner explicitly approved making the **source repository public**. GitHub confirmed the repository is **public** on 18 November 2026. This changes code visibility only, never the privacy of future personal media or data. A public source repository is compatible with a private personal catalogue **only** when future server-side access control, asset authorisation and storage are implemented separately. No auth, private data, private media or deployment is present in this fixture branch.

### Reuse and licensing

Repository visibility and code licensing are different decisions. No standalone software licence has been selected in this repository; public source visibility alone does not establish an open-source redistribution licence. Select an explicit licence before presenting this project as open-source software. Private manga and personal data must remain separately authorised regardless of any future code licence.

## Live synthetic demonstration

The `master` branch has a gated GitHub Pages workflow: only after `npm ci`, typechecking, **19 Vitest unit tests**, a Vite production build and **12 Playwright browser tests** succeed will it publish the synthetic demo. It cannot deploy private manga, as none is connected. A real public preview URL must be confirmed from the first successful Pages deployment; do not invent one before it exists.

For a future Cloudflare Pages site, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The Git integration build uses `npm ci && npm run build`, output `dist`, production branch `master`. Cloudflare deployment requires an owner-controlled connection in the Cloudflare dashboard. No credentials are needed or accepted in browser source.
