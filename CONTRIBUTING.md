# Contributing and AI agent collaboration

## Scope and source of truth

This repository owns Taiyou's Manga Library only. Do not modify the Novel Library, Manga Retriever, Manga Storage Controller, Shared Core/Hub, Anime or Movies/TV repositories from a Manga task. The private Hugging Face dataset is also outside the code repository's normal change scope.

Before substantial work, follow AGENTS.md. Inspect local Git status/diffs, current master SHA, branches, open PRs/issues, recent commits, CI and relevant implementation. If there is no local checkout, inspect remote GitHub state and do not claim to have checked local Git status.

Historical reports and AI summaries are not authoritative current state. Read docs/PROJECT_STATUS.md, then trace source and tests. Classify claims as implemented, partially implemented, planned, deprecated, historical/superseded or unverified.

## Starting a task

1. Inspect the latest master and preserve all existing local changes.
2. Check for an existing branch/PR implementing the same change.
3. Read the relevant architecture, data, security, deployment and ADR docs.
4. Reproduce the issue and define acceptance criteria.
5. Identify privacy, media, revision, performance and backward-compatibility impact.
6. Create a short-lived branch from current master.
7. Implement the smallest coherent change with focused tests.
8. Update the owning docs and current project status in the same PR.

## Development and validation

Use Node.js 22+ and the committed lockfile:

    npm ci
    npm run typecheck
    npm test
    npm run build
    node scripts/check-bundle.mjs

For production Chromium browser checks:

    npm run build
    E2E_PRODUCTION=1 npm run test:e2e

For Firefox/WebKit smoke:

    npm run build
    npx playwright test --config playwright.cross-browser.config.ts

Never claim tests passed unless the exact command/workflow completed successfully. A unit test is not proof of private OAuth, Cloudflare secrets, a live HF write or physical-device behaviour.

## Data and security

- Public repository content is source and synthetic fixtures only.
- Never commit private manga, private catalogues, original covers/pages, personal backups, OAuth tokens, owner passphrases or secret values.
- VITE_* variables are public. Store secrets only in Cloudflare Pages Functions runtime configuration.
- Private catalogue/media reads must use the authenticated same-origin gateway.
- Do not add N+1 metadata fetches: load the complete catalogue once and filter locally. Per-cover, per-manifest and per-page requests are expected media requests.
- Personal progress/annotations/collections/analytics remain browser-local. Automatic sync is not implemented.
- The Storage Controller owns imports, media upload, backup, migration and original-media deletion. Do not edit it or the private dataset as part of a Reader task.
- Destructive data changes, expanded OAuth scopes, production secret changes and permanent deletion require explicit owner approval.

## User experience

Preserve the approved Taiyou's Manga Library branding, six visible shelves, six themes, cloud indicator placement, three-cover Home hero, Novel-style shared chrome, Master/analytics composition and continuous whole-chapter vertical reader. Do not copy Novel EPUB controls or auth/storage. Use accessible controls, visible focus, meaningful states and no browser-native alert/confirm dialogs.

## Pull requests and releases

PRs must explain:
- User problem and expected behaviour.
- Implementation and affected files.
- Data/privacy/security and compatibility impact.
- Tests run with exact workflow links.
- Manual acceptance still needed.
- Rollback and documentation updates.

Routine non-destructive PRs may be merged and deployed after required checks pass, as authorised by the owner. Merge the exact green PR head SHA, then verify the post-merge Cloudflare live smoke for the merged master SHA. Do not conflate merged, deployed and owner-authenticated acceptance.

## Reporting

Keep the final report concise. State what changed, PR/commit, tests and deployment evidence, plus remaining unverified gaps. Never hide a failed check or claim completion from a plan alone.
