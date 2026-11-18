# Security and Responsible Disclosure

This repository is intended to contain **source code and synthetic demonstration data only**. Public source visibility is not permission to publish personal catalogues, licensed manga binaries, credentials or user annotations.

## Reporting a security issue

Please avoid creating a public GitHub issue that contains exploit details, secrets or private data. If GitHub private vulnerability reporting is enabled, use **Security > Advisories > Report a vulnerability** on this repository. If that option is unavailable, contact the repository owner privately through an established trusted channel rather than exposing vulnerability details in public comments.

Please include affected commit/version, a minimal synthetic reproduction, impact and suggested mitigation. Do not test against real private storage or third-party services without authorisation.

## Boundaries

- The prototype has **no production deployment, authentication, private storage provider or connected manga sources**.
- Synthetic cover and chapter fixtures are not real copyrighted media.
- Browser `VITE_*` environment variables are public by definition and must never contain secrets.
- No scraping, paywall circumvention, open media proxies or external URLs in chapter manifests.
- Uploaded archives and images will require independent server-side binary validation, not just the current metadata parser.
- Future private assets must require server-side authorisation and revision-safe writes.

For threat model and future controls see [docs/SECURITY.md](docs/SECURITY.md) and [ADR-006](docs/adr/006-manga-rights-and-private-asset-adapter.md).

## Supported versions

This is a development prototype. There is currently no released production version or security-support guarantee.
