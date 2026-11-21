# Roadmap and acceptance

**Current baseline:** see docs/PROJECT_STATUS.md.  
**Rule:** roadmap status is not implementation evidence. Re-check source, PRs, CI and live acceptance before starting work.

## Completed milestones

| Milestone | State | Evidence |
|---|---|---|
| Safe public source and synthetic reader foundation | Implemented | PRs #1–#18; domain validators, continuous chapter reader, stable routes and browser tests |
| Local progress, preferences and sample offline | Implemented | PRs #12–#22; versioned local records, manual sample chapter download and release-fingerprinted service worker |
| Personal shelves, annotations, collections and backup | Implemented | PRs #23–#27, #34–#35 |
| Advanced local search and evidence-based catalogue analytics | Implemented | PR #28 and current advancedDiscovery.ts |
| Firefox/WebKit automation and release hardening | Implemented | PRs #29, #32–#33 and current cross-browser workflow |
| Owner-only Hugging Face catalogue access | Implemented in code | PR #37 and current auth/library Functions |
| Authenticated private covers and chapter pages | Implemented in code | PRs #42, #47–#52; current media gateway and SHA/revision validation |
| Canonical Controller catalogue compatibility | Implemented | Current MangaEntry parser and Controller metadata reconciliation contract |
| Novel-style Manga navigation, details, cloud control and homepage | Implemented | PRs #41, #47, #50, #53–#61 |
| Master Controls, local usage journal and protected source metadata corrections | Implemented in code | PRs #56–#62 and current functions/api/master.ts |
| Novel-style analytics dashboard | Implemented | PR #63 |
| Dynamic three-day calendar labels on rolling analytics chart | Implemented | PR #64; current analyticsChartDates.ts and regression tests |

## P0: verify the live private-owner path

**State: partially implemented / owner-authenticated acceptance must be recorded.**

- Verify the production Cloudflare Pages Functions runtime has the expected HF repository/owner/client settings and server-only secrets. Never print secret values.
- Verify the dedicated OAuth callback and read-only login with the actual owner account.
- Verify private cover loading, chapter manifest loading, page display, revision mismatch handling and logout/cache clearing.
- Verify the separate write OAuth scope, TAIYOU_OWNER_PASSPHRASE configuration, 10-minute owner grant and a title/creator/publication-status correction against a disposable private dataset or an explicitly approved test record.
- Confirm that a correction preserves immutable manga/chapter/page IDs and public slug.
- Record which checks were automated and which were genuinely performed by the owner. Do not treat anonymous live smoke as owner-authenticated proof.

## P1: physical-device and large-chapter acceptance

**State: planned/manual.**

- Test Android Chrome and iOS Safari on physical devices using the original synthetic Five Chapter Scroll Trial.
- Verify whole-chapter scrolling, chapter-only previous/next, touch targets, focus/keyboard, rotation, safe areas, resume after backgrounding and theme contrast.
- Run authorised disposable 300-, 500- and 1,000-page image sets on a low-memory phone.
- Measure initial load, scroll jank, peak memory where available, decoded-image count, orientation changes and recovery after storage eviction.
- Do not claim the binary-search geometry tests establish hardware memory performance.

## P2: private gateway and owner-edit hardening

**State: partially implemented; extend only where evidence shows a gap.**

- Add or extend isolated integration tests for expired/revoked OAuth sessions, wrong owner, wrong repository, invalid IDs, revision races, concurrent owner edits, oversized catalogue responses, MIME mismatch, byte-length mismatch, SHA mismatch and upstream timeouts.
- Keep tests on synthetic fixtures or a disposable private dataset. Never place live manga or tokens in public CI.
- Verify logout removes local private cover cache and that service worker/API responses remain separate.
- Keep owner write fields narrow unless a reviewed schema/permission change explicitly expands them.

## P3: possible future capabilities, not commitments

These need a separate design review and explicit owner approval before implementation:

- Private chapter offline downloads. Requires clear device-accessibility warning, opt-in per chapter, quota/eviction policy, revision invalidation and safe logout semantics. Do not conflate this with current synthetic offline downloads or cached covers.
- Automatic cross-device personal-data sync. Requires a versioned server schema, per-device identity, revision/ETag conflict resolution, tombstones, backup/recovery and explicit privacy model. Current manual JSON transfer remains the supported method.
- Shared Hub/Shared Core integration. Only if there is a concrete user benefit and a stable pinned contract; the Manga app must remain independently usable.
- Additional analytics or charts. Preserve prospective device-only measurement, opt-out and truthful estimates. Never fabricate historical reading time.
- Expanded source metadata editing. Any field expansion needs provenance/rights review, revision guard, backup and explicit owner approval.

## Operational maintenance

- Review Dependabot PRs individually. React 19, Vite plugin major versions and GitHub Actions major versions require compatibility review and full CI, not blind merge.
- Maintain measured JS/CSS bundle budgets.
- Keep the service-worker fingerprint and two-release rollback tests.
- Re-check Cloudflare live smoke after every master merge.
- Keep current documentation in sync with code; archive dated status snapshots rather than appending contradictory current statements.

## Explicit non-goals

- No unlicensed downloads, scraping of protected sites, paywall/DRM bypass or arbitrary URL image proxy.
- No public hosting of private manga or original covers.
- No private media upload, migration or permanent deletion from the reader app.
- No implicit reuse of Novel Library cookies, private dataset or personal records.
- No runtime dependency on Shared Core or the parent Hub without a reviewed ADR.
