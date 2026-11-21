# Advanced search and reading analytics (19 November 2026)

## Advanced Search
The All Manga view combines existing text/genre/publication filters with creator name, minimum and maximum chapter counts, minimum **personal** rating, personal reading state and genuine offline chapter availability. Results use only in-memory catalogue and locally stored user data; no remote search or usage tracking occurs.

Filters are reflected in bookmarkable `/library` query parameters. Invalid chapter ranges show a warning and no results, rather than silently changing inputs.

## Analytics
Metrics are derived solely from local validated reading positions, personal shelves, annotation ratings and actual cached chapter IDs.

- Series with a saved position; currently reading; Trying Out; Finished; To Be Read
- Number of downloaded chapters and series with offline media
- Count and mean of personal ratings, rating distribution
- Latest **saved positions**, including chapter, page and date
- Genres represented among currently reading series

Historical usage before this analytics release cannot be reconstructed from a single last-position record. The prospective tracked usage journal is described below.

## Release regression
Continuous chapter scrolling, previous/next chapter navigation, public fixture boundaries and saved reading positions remain unchanged. This feature requires responsive, keyboard and browser checks after merge.


## Manga reading usage journal, from 21 November 2026

The Analytics tab now tracks approximate real foreground, focused and non-idle app time, reading time, per-manga duration, offline time, the past 14 days and verified chapter/page and reading actions. This is device-local and starts with this release; historical minutes cannot be reconstructed from saved progress. Slices are capped at 30 seconds and activity is paused on background tabs or after three minutes of idle time. The journal retains at most 400 days and 500 actions. A checkbox, JSON export and typed-confirmation clearing are available. It sends no personal analytics to Hugging Face. Private progress summaries can show earlier chapters before manifest download, but the reader still validates page IDs against the original protected manifest.

### Novel Library UI parity, 21 November 2026
The Manga Analytics landing view mirrors the current Novel UsageDashboard: four time cards in the order Active app time, Reading time, Offline app time and Today; a 14-day paired-bar chart with blue app bars (#64779c) and purple reading bars (#b46dac), aligned to a shared scale; a top-ten Most read manga list; and one compact privacy-controls card. Zero reading activity must render a zero-height reading bar instead of fabricating a duration. The eight manga catalogue summary metrics, recent positions, reading activity, genres and personal ratings are preserved under a collapsed **More manga insights** disclosure. Keep this optional detail accessible by keyboard and on mobile. Always compare against the Novel Library source, not a screenshot-only approximation.
