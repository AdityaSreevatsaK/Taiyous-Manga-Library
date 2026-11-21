# Firefox and WebKit parity

Primary CI runs the full TypeScript/Vitest/build/Chromium suite. .github/workflows/cross-browser.yml adds a focused production-build smoke suite for Firefox and WebKit.

The current e2e/cross-browser.spec.ts covers:
- Desktop Home, six visible navigation links, approved transparent brand artwork and default Sepia theme.
- Mobile More navigation at 320px, six theme choices, theme persistence, Master route and password-free Analytics navigation.
- No horizontal overflow at desktop and mobile sizes.
- A multi-image whole-chapter vertical reader with preserved original aspect ratios.
- Chapter-only previous/next navigation and first/last chapter boundaries.
- Device-local shelf persistence without changing source publication status.
- Novel-style notification appearance, automatic dismissal and removal on navigation.

Tests use public synthetic fixtures only. They do not authenticate the owner, read private manga or verify the Cloudflare production secrets.

This runs Firefox and WebKit engines under Linux. It is not proof of physical iOS Safari or Android Chrome behaviour. A real iPhone Safari and Android Chrome session, including offline updates and low-memory chapters, remains a separate acceptance item. Cross-device personal-data synchronisation is not implemented.
