# Firefox and WebKit parity

Primary CI continues to run Chromium across the full regression suite. `.github/workflows/cross-browser.yml`
adds a separate production-build smoke suite for the two other browser engines:
- Eight desktop sections, mobile More navigation, logo and theme persistence
- Multi-image whole-chapter vertical scrolling with preserved original aspect ratios
- Chapter-only previous/next navigation and end boundary
- Device-local shelf persistence without changing source publication status

This tests browser engines under Linux, not real Android/iOS hardware.
A real iPhone Safari and Android Chrome session, including offline updates and low-memory
chapters, remains a release check. Cross-device synchronisation is not implemented.
No protected manga content is downloaded or used in tests.
