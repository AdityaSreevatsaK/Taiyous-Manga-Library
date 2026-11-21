# Integration boundaries

## Independence first

Taiyou's Manga Library is an independently deployed app. It must remain usable without the Personal Hub, Shared Core or Novel Library. It has its own manga domain, OAuth client, Cloudflare Functions, private dataset and release pipeline.

## Active integration: private Hugging Face dataset

The application reads the private dataset AdityaSreevatsaK/Taiyous-Manga through its own same-origin Cloudflare Pages Functions. The catalogue endpoint returns a complete revision-pinned catalogue. Covers, manifests and pages are served through authenticated same-origin media endpoints. The browser never receives a Hugging Face bearer token or private dataset URL.

Normal catalogue discovery is local filtering over the loaded catalogue. Do not add per-manga metadata fetches for search, tags, shelves or collections. Per-manga requests are reserved for actual cover assets; per-chapter requests for manifests; per-page requests for image bytes.

See docs/HF_READONLY_CONNECTION.md and docs/ARCHITECTURE.md.

## Active integration: Manga Storage Controller

The separate repository Taiyou-Manga-Storage-Controller is the storage control plane for approved imports, catalogue reconciliation, backups, migration and original-media deletion.

The Reader consumes its canonical v1 data/library.json contract, including optional cover descriptors, creatorRoles and metadataSources. The canonical private layout includes data/covers, data/manifests and data/manga. The Controller preserves immutable manga/chapter/page IDs and private rights/provenance records.

Reader ownership:
- Read the private catalogue and deliver authorised private media.
- Maintain browser-local progress and personal organisation.
- Make narrowly scoped, protected source corrections to title, creators and publicationStatus.

Controller ownership:
- Import/validate original images and archives.
- Upload private media and manifests.
- Back up and reconcile catalogue/media.
- Perform approved migrations and source-media deletion.

Do not modify the Controller or private dataset from a Manga Library code/documentation task. If its contract changes, inspect the Controller's current canonical contract read-only, update this repo's compatibility docs/tests and coordinate a separately reviewed cross-repo change.

## Novel Library relationship

Novel Library is a design reference for approved shared chrome, details, cloud icon, toasts, Master layout and analytics. It is not an API dependency. Do not reuse its Hugging Face cookie, private dataset, personal storage, EPUB code or reader behaviour.

Before parity work, inspect the current Novel source and cite exact current component/CSS locations in the implementation plan. The Manga reader remains continuous vertical image reading.

## Shared Core and Hub

Shared Core remains an experimental candidate. No runtime package is currently imported. VITE_HUB_URL is reserved optional public configuration; its presence in .env.example does not prove a live Hub integration.

Adopt a pinned Shared Core contract only when a second consumer and measured benefit exist, with backwards-compatible types, runtime validation, tests and rollback. Never use a mutable sibling-repository import, submodule, floating Git URL or runtime CDN package.

## Authentication and cross-origin rules

Cloudflare Pages apps on different origins cannot share same-origin HttpOnly cookies automatically. Manga uses a dedicated OAuth client and callback. Never assume the Novel Library's login authenticates this app. Do not put tokens in URLs or localStorage.

## Integration change checklist

- Identify the owning repository for the changed data or capability.
- Read its current contract and implementation; do not trust old PR drafts.
- Preserve immutable IDs and source/personal-data separation.
- Add compatibility and failure tests.
- Do not modify sibling repositories or private data without explicit scope and owner approval.
- Update docs/PROJECT_STATUS.md and this file when an integration changes.
