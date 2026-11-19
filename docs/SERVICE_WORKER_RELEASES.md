# Verified offline application shell release transitions

Browser-installed shell caches are now distinguished by a release-specific service-worker build fingerprint and a uniquely allocated timestamp key. No unverified intermediate cache may supply navigation fallback or public JavaScript/CSS. A ready marker is written **only after** the complete synthetic shell, public logos and offline fallback have been validated.

On activation, the newest two verified shell caches are retained while incomplete caches are removed. The oldest ready cache is available for rollback if the newest verified cache is removed. Manga chapter downloads live in separate cache storage and are never swept by this release logic.

`scripts/sw-release-transitions.test.mjs` runs the actual service worker in a minimal simulated CacheStorage/event environment. It checks incomplete staged releases, failed precache cleanup, identical-timestamp installs, two-release retention and rollback. This tests deterministic cache logic, not actual browser storage eviction or a physical iOS/Android upgrade.
