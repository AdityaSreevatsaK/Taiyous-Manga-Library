# Taiyou's Manga Library

> **Public-source synthetic manga reader.** The five reader milestones were merged into `master` on 19 November 2026. The latest merged application is at commit `faf7b515`; the deployment must be checked independently because Cloudflare Pages was disconnected from GitHub. The application intentionally uses fictional demonstration content rather than personal manga images.
>
> **Verified on GitHub Actions:** TypeScript typecheck, 34 unit tests, production build, production bundle budgets and 37 Playwright browser tests passed on the release commit. [Review the CI run](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/actions/runs/44503328931).
>
> **Live deployment:** [taiyous-manga-library.pages.dev](https://taiyous-manga-library.pages.dev/). A remote smoke check on 19 November found the previous production build still live, with the new offline service worker missing. See [deployment verification PR #15](https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/15).
>
> **Privacy:** No real manga media, private Hugging Face datasets or authentication credentials have been added. Cloudflare access, private asset delivery and cross-device sync are not yet implemented.

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

- Responsive horizontal and continuously scrolling vertical manga reader, touch and keyboard navigation, fullscreen/focus mode and reading preferences.
- Browser deep links and Back/Forward navigation for catalogue, series and chapters.
- Versioned local progress and reading settings, with safe handling of stale or corrupt records.
- Opt-in offline downloads for fictional chapters, offline library navigation, service worker and cache-integrity tests.
- Accessibility, error recovery, responsive and production-browser checks.

The current catalogue contains deliberately fictional fixtures. No real manga or private backend is connected.

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

Private Hugging Face storage integration, user authentication, authorised media delivery and cross-device progress persistence remain separate future work. No private manga content belongs in Git or an unauthorised public static site.

## Licensing

A public repository does not grant a manga redistribution licence. No standalone software licence has been selected; treat the repository as source-visible rather than licensed open-source code until one is chosen.
