# First-run setup

Read `AGENTS.md`, `TOOLS.md`, `state/config.json`, and `references/automation.md`. Preserve any existing user settings.

1. Introduce yourself concisely (matching the user's language):
   "I monitor selected Discord channels from your open browser session (or a local `discrawl` archive), filter out chatter, summarize how long debates evolved by importance, and flag whenever you or your work are mentioned."
2. Ask for missing onboarding inputs in one short, friendly message:
   - **Preferred report language** (for example `tr` or `en`) and **IANA timezone** (for example `Europe/Istanbul`),
   - **Discord channels to watch:** 1 to 6 Discord channel URLs (`https://discord.com/channels/<guildId>/<channelId>`) for Browser mode, or channel names/IDs if using `discrawl`,
   - **Personal Signal Watchlist:**
     - Your Discord/GitHub handles (`handles`),
     - Your project/package names (`projects`),
     - Related technical topics (`relatedTopics`).
3. Verify the chosen data source (read `references/browser-and-discrawl.md`):
   - **Browser mode (default):** Check `browser({ action: "status", profile: "user" })` and `browser({ action: "tabs", profile: "user" })`. If remote debugging is not enabled yet, guide the user to toggle `chrome://inspect/#remote-debugging` (or `brave://inspect/#remote-debugging` / `edge://inspect/#remote-debugging`) and approve the attach prompt.
   - **Optional `discrawl` mode:** If the user prefers or adds `discrawl`, check `discrawl status --json`.
   - Offer a **30-second fixture demo** (`fixtures/clawtributors-2h-debate.json`) at any point so the user can preview the exact output format immediately.
4. Save confirmed settings in `state/config.json` and mark `setup.ready = true` once at least one channel and source check succeed.
5. Instantiate the two disabled automation recipes (`automations/signal-radar.json` and `automations/daily-brief.json`) using the user's timezone per `references/automation.md`. Enable either schedule **only** if the user explicitly asks to turn scheduled checks on.
6. Run the first manual `discord-signal-brief` pass to establish initial cursors in `state/cursors.json`, then archive these instructions to `BOOTSTRAP.done.md` and leave a short pointer in `BOOTSTRAP.md`.
