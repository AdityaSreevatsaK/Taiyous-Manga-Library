# Taiyou's Manga Library

> **Live synthetic manga reader:** [taiyous-manga-library.pages.dev](https://taiyous-manga-library.pages.dev/). The public build contains only fictional demonstration artwork, including a five-chapter trial. No personal manga files, Hugging Face tokens or private catalogues are included.
>
> **Release checks:** GitHub Actions runs TypeScript, unit, production-build and Chromium browser tests. After each `master` push, a separate live workflow verifies Cloudflare has deployed the exact build, its deep links and offline service worker. Passing CI does not replace real-device testing.
>
> **Privacy:** No authentication, private asset delivery or automatic cross-device sync is implemented. Manual backup and restore of local reading positions is available without uploading user data.

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

## Implemented on `master`

- Continuous full-chapter vertical scrolling with Previous/Next navigating **chapters only**, mobile layouts, focus mode and reading preferences.
- Browser deep links and Back/Forward navigation for catalogue, series and chapters.
- Versioned local progress, Continue Reading shelf and manual JSON backup/restore. Malformed data is preserved and newer progress is not overwritten.
- Opt-in offline downloads for fictional chapters, offline library navigation, service worker and cache-integrity tests.
- Accessibility, error recovery, responsive and production-browser checks, plus automated live Cloudflare smoke verification.

The current catalogue includes **Five Chapter Scroll Trial**, containing 36 original illustration pages over five chapters, with no real manga or private backend connected. See the [chapter reader acceptance checklist](docs/CHAPTER_READER_ACCEPTANCE.md) to test scrolling, chapter navigation, offline copies and progress on mobile.

## Non-negotiable boundaries
- The owner has authorised public repository source visibility. Verify the actual GitHub setting before asserting that the change is live. No personal media or private credentials may be added to Git.
- No real private media or credentials in Git, browser bundles, test fixtures or GitHub Actions logs.
- No unapproved production deployment. Owner-approved merges to `master` may automatically deploy through Cloudflare; use short-lived branches, CI and reviewed pull requests.
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

## Development and deployment

Node.js 22+:

```bash
npm ci
npm run typecheck
npm test
npm run build
E2E_PRODUCTION=1 npm run test:e2e
```

The production source branch is `master`, with Cloudflare Pages Git integration expected to deploy `npm ci && npm run build` from `dist`. A successful GitHub CI run confirms repository code quality, **not** that Cloudflare has published the same commit. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Current limitations

Private Hugging Face storage integration, user authentication, authorised media delivery and **automatic** cross-device progress sync remain separate future work. Manual progress transfer is available through the library's local backup panel. No private manga content belongs in Git or an unauthorised public static site.

## Licensing

A public repository does not grant a manga redistribution licence. No standalone software licence has been selected; treat the repository as source-visible rather than licensed open-source code until one is chosen.
