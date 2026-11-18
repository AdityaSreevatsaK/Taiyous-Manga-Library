# Taiyou's Manga Library

> **Private, scaffold-stage application.** This repository has a functioning starter UI, local search, typechecked Manga domain models, basic tests and a build workflow. It has **no private catalogue adapter, authentication, import/export, cloud synchronisation, playback or production deployment yet**. Never represent a placeholder as a finished feature.

## Mission
Read and organise legitimately acquired manga with chapter/page-level progress and optional offline access. The user experience should remain readable, fast, polished and accessible on phones, tablets and desktop. The existing novel library is the visual inspiration, not an implementation dependency.

## Place in the five-repository ecosystem
- [Shared Core and parent Personal Hub](https://github.com/AdityaSreevatsaK/Taiyous-Shared-Core): experimental common contracts, presentation pieces and navigation. **Not a mandatory network dependency.**
- [Novel Library](https://github.com/AdityaSreevatsaK/Taiyous-Personal-Library): existing production EPUB app. It must not be modified by this repo's agents.
- **This repo:** owns manga-specific models, local UX, future storage adapter and future release pipeline.
- Other modules remain independently versioned and deployed.

## Quick start (Node.js 22+)
1. Clone this private repository and open it in your editor.
2. Run `npm install` to install dependencies. **Commit the generated `package-lock.json` in the first dependency-maintenance PR**, then migrate CI to `npm ci`.
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
- Repo visibility: private until the owner explicitly approves changing it.
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
