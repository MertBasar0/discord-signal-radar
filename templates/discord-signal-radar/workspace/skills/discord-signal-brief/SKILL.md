---
name: discord-signal-brief
description: "Capture unread Discord activity from an open browser session or local discrawl archive, cluster multi-hour debates with evolution tracking, detect personal/project mentions, and deliver a ranked briefing."
---

# Run a Discord Signal Briefing

## 1. Preflight & scope

1. Read `state/config.json`, `state/cursors.json`, and `templates/briefing.md`. Use `session_status` to establish the current timestamp.
2. **Fixture rehearsal path:** When the user asks for a demo or fixture test, run `node scripts/signal-engine.mjs --input fixtures/clawtributors-2h-debate.json --channel clawtributors --config fixtures/clawtributors-2h-debate.json` (or pass temporary watchlist flags via a scratch config), render the full briefing using `templates/briefing.md` without modifying `state/cursors.json`, and clearly label it `SYNTHETIC FIXTURE DEMO`.
3. For live runs, verify `setup.ready` is `true` and `channels` is non-empty. If incomplete, return `SETUP_PENDING` naming the missing fields without advancing cursors.

## 2. Capture channel slices safely

Depending on `sourceMode` in `state/config.json`:

- **`"browser"` (default for browser Discord users):**
  1. Call `browser({ action: "tabs", profile: config.browserProfile || "user" })` and locate an existing `discord.com` tab. If Chrome remote debugging is disconnected or no signed-in Discord tab is available, report the gap clearly (or return `SOURCE_UNAVAILABLE` without advancing cursors).
  2. For each configured channel (cap at 6 channels per pass):
     - Navigate that Discord tab to the configured channel URL (`https://discord.com/channels/<guildId>/<channelId>`) if not already viewing it, waiting briefly for messages to render.
     - Read visible conversation content with `browser({ action: "text", profile: config.browserProfile || "user", selector: "ol[data-list-id=\"chat-messages\"]" })` (fallback to `snapshot` if needed; avoid `[role="log"]` which matches Discord's empty ARIA live region) and save the raw capture to `captures/<channelKey>.txt`.
     - Never interact with the composer, reactions, or settings.
- **`"discrawl"` or `"hybrid"`:**
  1. If `discrawlBrowserCachePath` is set, optionally run `discrawl wiretap --path "<discrawlBrowserCachePath>"` (or plain `discrawl wiretap` for desktop cache) to refresh recent cached payloads.
  2. Export messages per channel with `DISCRAWL_NO_AUTO_UPDATE=1 discrawl --json messages --channel "<channelIdOrName>" --hours 24 --all > captures/<channelKey>.json`.

## 3. Cluster discussions & scan Personal Signals

For each captured channel:
```sh
node scripts/signal-engine.mjs \
  --input captures/<channelKey>.<txt|json> \
  --channel <channelKey> \
  --config state/config.json \
  --cursors state/cursors.json \
  --out captures/<channelKey>.analysis.json
```

Read each `captures/<channelKey>.analysis.json`.

## 4. Synthesize the ranked briefing

- **Scheduled quiet check:** If running inside a scheduled automation and **every** channel has `shouldNotify: false` and zero capture errors, commit any noise-only cursor advances and return `NO_REPLY`.
- Otherwise, write `reports/<UTC-timestamp>.md` in the user's configured `language` (`tr` or `en`) following `templates/briefing.md`:
  1. **Personal & Project Radar (Top Priority):** List every `direct_mention`, `own_project`, and `related_work` signal with exact channel, speaker, time, quoted excerpt, and why it matched. Say `Yok / None` explicitly when empty.
  2. **Ranked Topic Summaries (Highest `importanceScore` first):** Merge multi-hour threads into clean narrative arcs:
     - **Topic & Channel** (`firstTimestamp` – `lastTimestamp`, message & speaker count)
     - **How it started:** Initial proposal, question, or announcement
     - **What shifted / key objections:** Any reversals, realizations (`pivotsAndShifts`), or counter-arguments
     - **Current outcome / takeaways:** Final consensus, shipped link, or open question
  3. **Actionable Warnings & Breaking Notes:** Surface concrete CLI gotchas, bugs, release gates, or unanswered questions directed at the user.
- Read `reports/<UTC-timestamp>.md` back to verify it saved cleanly, **then** run `--mode commit-cursor` for each successfully processed channel so the watermark advances atomically.
