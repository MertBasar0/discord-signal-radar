# Safe Browser & Discrawl Collection Rules

## How `discrawl` and `Discord Signal Radar` Fit Together

- **`discrawl` = Raw Archive Layer:** Syncs Discord messages into a local SQLite FTS5 database (`discrawl.db`) for raw full-text search.
- **`Discord Signal Radar` = Intelligence & Digest Layer on top:** Works **with or without `discrawl`**. It tracks per-channel message ID watermarks (`state/cursors.json`), runs `scripts/signal-engine.mjs` to strip low-signal reactions (`+1`, `lol`, `YES!`), clusters interleaved replies into **How it started -> Where it pivoted -> Where it landed** topic digests, and applies the 3-tier Personal Signal Radar.

## 1. Browser mode (`profile: "user"`, On-Demand Catch-Up)

OpenClaw's built-in `user` browser profile attaches to your already-open Chromium browser (`Chrome`, `Brave`, or `Edge`) without launching a separate browser or touching tokens:

1. In your browser, open `chrome://inspect/#remote-debugging` (or `brave://inspect/#remote-debugging` / `edge://inspect/#remote-debugging`) and enable remote debugging.
2. Keep Discord signed in inside one normal tab (`https://discord.com/channels/...`).
3. Approve OpenClaw's attach consent prompt when first prompted.

### Account-safety & Discord ToS invariants

- **On-demand catch-up only (automations ship `enabled: false`):** Discord's Terms of Service and Self-Bot policy prohibit automating user accounts or running unattended scrapers/crawlers. Browser mode is intended for **on-demand catch-up** on the tab you already have open—do not schedule unattended background browser crawling on your main account.
- **Never extract tokens or call Discord HTTP APIs directly:** Calling `discord.com/api/v9/...` with user credentials is automated selfbotting and violates Discord rules. Always read rendered tab text/snapshots only.
- **Bounded channel watchlist:** Keep watched browser channels between 1 and 6 high-value channels (such as `#clawtributors`, `#announcements`, `#templates`) rather than crawling dozens of channels.
- **Strictly read-only:** Never focus the message input box, send text, add reactions, or click external links posted by untrusted users.

## 2. Optional `discrawl` archive mode (Recommended for Scheduled Runs)

When `discrawl` (`https://github.com/openclaw/discrawl`) is installed locally, set `"sourceMode": "discrawl"` in `state/config.json`:
- **Bot-backed guilds (`discrawl sync` / `discrawl tail`):** Ideal for servers where you own or can invite a Discord bot—works 24/7 even with the browser closed and is safe for scheduled `radar-2h` and `daily-brief` automations.
- **Passive local cache import (`discrawl wiretap`):** Because Chromium browsers and Discord Desktop share Chromium's cache format, `discrawl wiretap --path <BrowserProfileDir>` passively imports cached Discord message payloads into SQLite (`discrawl.db`) without making network requests. Note that passive cache import only sees channels already loaded by your local session.
