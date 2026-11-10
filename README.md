# Discord Signal Radar (`@mertbasar0/discord-signal-radar`)

An OpenClaw **Agent Template** that spares you from endless Discord scrolling. Attach it to your already-open Chromium browser session (`profile: "user"`, zero bot/token setup required) or an optional local [`discrawl`](https://github.com/openclaw/discrawl) SQLite archive to get:

1. **3-Tier Personal Signal Radar:** Direct `@mentions` & replies (`direct_mention`), untagged mentions of your own repositories/templates (`own_project`), and adjacent discussions in your technical domain (`related_work`).
2. **Multi-Hour Debate Evolution Digests:** Deterministic conversation clustering (`scripts/signal-engine.mjs`) merges interrupted discussions across multi-hour windows, filters out low-signal chatter, tracks how positions shifted (`startedWith` -> `pivotsAndShifts` -> `latestState`), and orders topics by importance.
3. **Watermark Deduplication & Quiet Schedules:** Tracks per-channel cursors (`state/cursors.json`) so messages are never summarized twice, with optional 2-hour radar and daily briefing automations that stay silent (`NO_REPLY`) when nothing meaningful happened.

## Install

Requires OpenClaw `2026.11.5-beta.1` (or `main`) with **Templates** enabled in **Settings -> Labs** (`gateway.controlUi.experimental.templates: true`):

```sh
openclaw templates add @mertbasar0/discord-signal-radar
```

Or add directly from a local clone:

```sh
git clone https://github.com/MertBasar0/discord-signal-radar.git
openclaw templates add ./discord-signal-radar/templates/discord-signal-radar
```

## Run tests

```sh
node --test test/signal-engine.test.mjs
```

## License

MIT
