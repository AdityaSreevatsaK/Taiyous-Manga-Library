# Test Strategy and Quality Gates

## Commands
`npm run typecheck`, `npm test`, `npm run build`. The initial workflow runs all three on pull requests and master; no browser E2E or deployed smoke exists yet. Do not claim they do.

## Testing layers
1. **Pure unit:** search, identity, sorting, status transformations, MangaEntry, MangaChapter, MangaProgress, invalid/empty inputs and Unicode names.
2. **Component:** keyboard and screen-reader labels, focus order, 320–390px overflow, 768px tablet and desktop layouts. Use deterministic fixtures with no private media.
3. **Repository adapter:** CRUD boundaries, lossless migrations, duplicate IDs, stale revisions, injected errors, cancellation and retries.
4. **Privacy/security:** redaction, invalid input, absent/expired session, forbidden mutations, path traversal, oversized payloads and unsafe URLs.
5. **Offline and sync:** cold offline launch after a controlled cache, browser eviction, two-device conflicting edits, tombstone protection, correct rehydration and recovery.
6. **Domain-specific:** Fixtures prove correct RTL/LTR page ordering, chapter transitions, resume on exact page, keyboard/touch operation and offline behaviour without exposing private image assets.

## Acceptance gates for a feature PR
Every new path has a positive, negative and boundary case. Tests fail on regressions and must not require external tokens. Assertions verify user-visible behaviour, not just DOM presence. Add a reproducible manual plan for gestures/real devices where automation is not possible.

## Release gates (future)
Successful locked install, typecheck, tests, build, vulnerability review, browser mobile/desktop checks, private endpoint auth tests, performance review, real-device sign-off and rollback verification. A green CI alone does not authorise deployment. Record the build SHA and scope.

## Risk register
Initial scaffolds intentionally omit persistence, authentication, image/video delivery, end-to-end tests, production CSP configuration and provider integrations. These omissions are documented, not hidden.
