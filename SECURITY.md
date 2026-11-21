# Security policy

This public repository contains application source and synthetic test fixtures only. Private manga, private catalogue exports, personal reading data, credentials and owner-only configuration must never be committed.

## Reporting

Do not publish exploit details, private media, tokens or personal data in a public issue. If GitHub private vulnerability reporting is enabled, use the repository's Security > Advisories workflow. Otherwise contact the owner through an established private channel.

Include the affected commit, a minimal synthetic reproduction, impact and mitigation. Do not test against the live private dataset or third-party services without authorisation.

## Current architecture

The production app uses Cloudflare Pages Functions for per-app Hugging Face OAuth, owner-authenticated private catalogue/media reads and a separately protected, revision-guarded source-metadata correction path. See docs/SECURITY.md and docs/ARCHITECTURE.md for the actual controls.

Personal progress, notes, ratings, tags, collections and usage analytics remain browser-local. The private chapter reader is online-only. Private media uploads, migration and deletion are handled by the separate Manga Storage Controller.

## Non-negotiable rules

- Never commit secrets, HF tokens, private media or personal backups.
- Never put secrets in VITE_* variables or browser-visible code.
- Do not bypass owner authentication, content rights, paywalls, DRM or provider access controls.
- Do not introduce arbitrary remote image fetching or an open proxy.
- Do not weaken session, CSRF/Origin, revision, MIME, byte-size or SHA validation.
- Do not perform destructive private-data changes without explicit owner approval and a verified recovery plan.

The repository is source-visible; no standalone software licence has been selected. Source visibility does not grant manga redistribution rights.
