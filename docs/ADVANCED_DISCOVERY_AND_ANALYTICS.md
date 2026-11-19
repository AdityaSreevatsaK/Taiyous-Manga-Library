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

The app does not claim time spent reading, streaks, completed chapter counts or cloud synchronisation because that event history is not recorded. No third-party analytics or additional network requests are needed.

## Release regression
Continuous chapter scrolling, previous/next chapter navigation, public fixture boundaries and saved reading positions remain unchanged. This feature requires responsive, keyboard and browser checks after merge.
