# Advanced discovery and reading analytics

## Advanced local search

The All Manga view filters the full in-memory catalogue. It supports:
- Text/title and alias search.
- Publication status and source tags.
- Creator/author names.
- Minimum/maximum chapter counts.
- Minimum personal rating.
- Personal reading state.
- Verified local offline chapter availability.

Search and filters run locally. They do not send queries, tags, personal ratings or notes to an external provider. Catalogue filters remain bookmarkable through safe /library query parameters. Invalid chapter ranges return no results with a warning rather than silently changing the user's input.

## Catalogue analytics

The additional manga insights are derived from the current loaded catalogue and validated device-local state:
- Series with a saved reading position.
- Currently Reading, Trying Out, Finished and legacy To Be Read counts.
- Verified downloaded sample chapters and series with offline media.
- Average personal rating and rating distribution.
- Recent saved positions, chapter/page and timestamp.
- Genres among Currently Reading series.

These are catalogue/progress summaries, not reading-time estimates. A saved position timestamp is not elapsed reading time.

## Prospective device-only usage journal

The usage journal was introduced on 21 November 2026. It records approximate activity prospectively:
- Active app time while the tab is visible, focused and recently used.
- Reading time while a manga reader is open.
- Offline app time while disconnected.
- Per-manga reading duration.
- Actions such as chapter opened, page viewed, chapter marked/reopened, shelf changed and personal edit.

Implementation is in src/domain/usageAnalytics.ts. Samples are taken every 10 seconds; gaps over 30 seconds are discarded; inactivity beyond 3 minutes pauses counting; each sample is capped at 30 seconds. The journal retains at most 400 daily buckets, 500 actions and 2,500 per-manga duration entries.

Tracking is opt-out and stored only in the browser. The user can export JSON or clear the analytics journal using typed confirmation. Clearing analytics does not clear saved progress, personal annotations, collections or the private catalogue. No third-party analytics or HF upload is used.

Historical reading minutes cannot be reconstructed from existing progress. Tracking starts prospectively with this release.

## Novel-style Analytics dashboard

The landing dashboard in Master Controls has:
1. Active app time.
2. Reading time.
3. Offline app time.
4. Today.

It also has a rolling 14-day paired bar chart for active app and reading time, a Most read manga list and a compact privacy-controls card. Manga-only catalogue metrics, recent positions, activity journal, genres and personal rating distribution remain under the collapsed More manga insights disclosure.

The two chart series use a shared scale. Reading bars remain zero-height when no reading duration exists; do not invent time to make the graph look populated.

Date labels are calculated from the current 14-day local calendar window. They display day and abbreviated month every three days, anchored to the current day, so the dates roll forward dynamically and remain correct across month/year boundaries.

## Privacy and accuracy invariants

- No analytics leave the device.
- No tracking while the page is hidden, unfocused or idle.
- No reconstruction of pre-release minutes.
- Do not infer page views from an unverified scroll position.
- Do not infer chapter completion from progress.
- Do not infer personal Finished state from source publicationStatus.
- Keep export/clear controls accessible and clearly scoped.
