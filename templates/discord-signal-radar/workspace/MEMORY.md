# Signal memory

- `state/config.json` holds watched channels, source mode, language, timezone, and the 3-tier personal watchlist.
- `state/cursors.json` tracks the last summarized message anchor per channel to prevent duplicate briefings.
- `reports/<UTC-timestamp>.md` stores completed briefings. Never store Discord tokens, cookies, or private credentials anywhere in this workspace.
