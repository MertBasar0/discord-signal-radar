# Discord Signal Radar (`@mertbasar0/discord-signal-radar`)

An OpenClaw **Agent Template** that spares you from endless Discord scrolling. Attach it to your already-open Chromium browser session (`profile: "user"`, zero bot/token setup required) or an optional local [`discrawl`](https://github.com/openclaw/discrawl) SQLite archive to get:

1. **3-Tier Personal Signal Radar:** Direct `@mentions` & replies (`direct_mention`), untagged mentions of your own repositories/templates (`own_project`), and adjacent discussions in your technical domain (`related_work`).
2. **Multi-Hour Debate Evolution Digests:** Deterministic conversation clustering (`scripts/signal-engine.mjs`) merges interrupted discussions across multi-hour windows, filters out low-signal chatter, tracks how positions shifted (`startedWith` -> `pivotsAndShifts` -> `latestState`), and orders topics by importance.
3. **Watermark Deduplication & Quiet Schedules:** Tracks per-channel cursors (`state/cursors.json`) so messages are never summarized twice, with optional 2-hour radar and daily briefing automations that stay silent (`NO_REPLY`) when nothing meaningful happened.

---

## How `discrawl` and `Discord Signal Radar` Fit Together

| Layer | Role | When to use |
| :--- | :--- | :--- |
| **[`discrawl`](https://github.com/openclaw/discrawl)** *(Raw Archive Layer)* | Syncs Discord messages into a local SQLite FTS5 database for raw full-text search. | Great when you have a bot token on the server or access to a local/shared `discrawl.db` archive. |
| **`Discord Signal Radar`** *(Intelligence & Digest Layer)* | Sits on top of raw messages—works **with or without `discrawl`**. Tracks your last-read message ID watermark (`state/cursors.json`), runs `scripts/signal-engine.mjs` to strip low-signal reactions (`+1`, `lol`, `YES!`), clusters interleaved replies into **How it started -> Where it pivoted -> Where it landed** topic digests, and flags 3-tier personal/project signals. | Use **on top of `discrawl`** when you have a local SQLite archive, or use **directly on your open browser tab** when you're a regular community member without a bot token or shared server DB. |

---

## Account Safety & Discord ToS Guidance

> [!IMPORTANT]
> **On-Demand Browser Mode vs. Scheduled Local Archive:**
> - **Automations are disabled by default (`enabled: false`):** Both bundled cron recipes (`automations/signal-radar.json` and `automations/daily-brief.json`) ship disabled so nobody accidentally schedules unattended background browser scraping on their main Discord account.
> - **Browser mode (`profile: "user"`) is for on-demand catch-up:** Discord's Terms of Service and Self-Bot policy prohibit automating user accounts or running unattended scrapers/crawlers. Browser mode never extracts authentication tokens, never calls Discord HTTP/WebSocket APIs directly, and never sends messages or reactions—it only reads the already-rendered DOM of the tab you have open when you ask for a catch-up briefing.
> - **Use local `discrawl` for scheduled background runs:** If you want recurring unattended digests (`radar-2h` or `daily-brief`), point `state/config.json` at a local `discrawl` SQLite database (`sourceMode: "discrawl"`) rather than scheduling automated browser-tab navigation on a user account.

---

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

## Zero-Setup Fixture Preview

Right after adding the template, ask the agent:

> `"Run the fixture demo"`

It will run `node scripts/signal-engine.mjs` against `fixtures/clawtributors-2h-debate.json` and render a full 3-tier Personal Signal Radar + multi-hour debate evolution digest before you even connect Chrome or `discrawl`.

## Run tests

```sh
node --test test/signal-engine.test.mjs
```

## License

MIT
