# Copy into a dedicated AI-agent session: Manga

Act as the **Principal Engineer, domain architect, security reviewer and accessibility lead** for **Taiyous-Manga-Library**:
https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library

This is ONE of five Taiyou repositories. Your session owns **only** this repository. Other sessions own Shared Core/hub, existing Novel Library, Manga, Anime and Movies & TV separately.

## Mandatory preparation
1. Inspect actual `master`, branches, open PRs, workflow failures, repo settings and current files. Do not assume historical descriptions represent current code.
2. Read ALL of `README.md`, `AGENTS.md` and `docs/*.md`, including architecture, data contracts, security, integration, roadmap, decisions, operations, testing and design system.
3. Run `npm install`, `npm run typecheck`, `npm test` and `npm run build`; document failures, no suppressions.
4. Summarise actual baseline and list all gaps before designing implementation.

## Primary mission
Read and organise legitimately acquired manga with chapter/page-level progress and optional offline access. Concentrate on:
Panel and page ordering, right-to-left versus left-to-right reading, vertical scrolling, chapter/volume structure, image dimensions, page preload limits and full-screen touch navigation.

Current scaffold is deliberately small: it has types, a local search function, tests, an empty catalogue and a responsive UI. There is **NO** live data, sign-in, media source integration, playback, cloud sync or deployment. Do not misrepresent these as implemented.

## Suggested first deliverable
A read-only local catalogue with an explicit no-data state, a chapter manifest validator, and a page reader prototype using generated/owned fixture images.
Acceptance: Fixtures prove correct RTL/LTR page ordering, chapter transitions, resume on exact page, keyboard/touch operation and offline behaviour without exposing private image assets.

## Safety
Preserve privacy and independent app operation if the hub is down. No real media/credentials in Git. No copyrighted-content scraping or paywall/DRM bypass. No cross-origin session assumptions. Keep stable IDs, typed migrations and revision-guarded personal writes when storage is added. Tests must run with synthetic fixtures and no paid API.

## Engineering workflow
Implement on a short-lived branch, add unit/browser tests and authoritative docs, open a PR and report exact changes, test evidence, remaining risks and next steps. Do not touch the other four repositories, force-push `master`, deploy production, change visibility or delete user data without owner approval.

## Coordination message for Shared Core
If you identify genuine reusable contracts/UI, report **export name, consuming apps, API shape, compatibility/tests and measured benefit** to the Shared Core owner. Do not copy or silently modify other repos.

Deliver a complete, evidence-backed baseline and prioritised next development milestones. Continue implementation within approved scope rather than stopping after a superficial plan.


## Session 3 implementation handover (18 November 2026)

**Current PR:** https://github.com/AdityaSreevatsaK/Taiyous-Manga-Library/pull/2  
**Branch:** `feature/local-manga-catalogue-reader` (draft; DO NOT MERGE without successful verification).  
**Canonical `master`:** unchanged from `a0eb1e602469c0820475c0b450cdaed8ee62115d` as of opening PR.

Work already committed in PR: runtime contracts/validators for entries, manifests, progress, rights and archive metadata; fictional local catalogue with alias search, status/tag/collection filters, sorting and series details; original browser-generated synthetic PNG image reader with bounded image caching, RTL/LTR/vertical page stepping, keyboard/swipe navigation, chapter boundaries, exact in-memory resume, missing-page errors and retry; Vitest and Playwright test suites; rights/storage ADR and shared UI RFC. The actual private catalogue remains empty and disconnected, and no personal data or external media is embedded.

**Next agent's first tasks:** read `docs/DEVELOPMENT_REPORT_2026-11-18.md`, inspect PR diff and newest Actions logs, restore runner execution, use an online Node 22 environment to `npm install`, commit the genuine lockfile and switch CI to `npm ci`, then run and fix `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`. Playwright requires `npx playwright install chromium`. Verify 320/375/390/768/1280 px layouts and synthetic offline/error behaviours. **None of these commands has passed in the current sandbox.** The last feature-branch Actions run also failed before any job steps started.

Do not enable real manga imports, sync, private auth, offline media caching or production deployments without separately approved source-rights/storage ADR and secure adapters. Keep Shared Core independent; the candidate reuse proposal is `docs/SHARED_CORE_RFC_001.md` and must be conveyed to Session 1 rather than committing to that repo.
