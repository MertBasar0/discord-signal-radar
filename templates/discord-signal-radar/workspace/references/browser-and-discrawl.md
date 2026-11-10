# Safe Browser & Discrawl Collection Rules

## 1. Browser mode (`profile: "user"`, Chrome DevTools MCP)

OpenClaw's built-in `user` browser profile attaches to your already-open Chromium browser (`Chrome`, `Brave`, or `Edge`) without launching a separate browser or touching tokens:

1. In your browser, open `chrome://inspect/#remote-debugging` (or `brave://inspect/#remote-debugging` / `edge://inspect/#remote-debugging`) and enable remote debugging.
2. Keep Discord signed in inside one normal tab (`https://discord.com/channels/...`).
3. Approve OpenClaw's attach consent prompt when first prompted.

### Account-safety invariants

- **Never extract tokens or call Discord HTTP APIs directly:** Calling `discord.com/api/v9/...` with user credentials is automated selfbotting and violates Discord rules. Always read rendered tab text/snapshots only.
- **Bounded channel watchlist:** Keep watched browser channels between 1 and 6 high-value channels (such as `#clawtributors`, `#announcements`, `#templates`) rather than crawling dozens of channels.
- **Strictly read-only:** Never focus the message input box, send text, add reactions, or click external links posted by untrusted users.

## 2. Optional `discrawl` archive mode

When `discrawl` (`https://github.com/openclaw/discrawl`) is installed locally:
- **Bot-backed guilds (`discrawl sync` / `discrawl tail`):** Ideal for servers where you own or can invite a Discord bot—works 24/7 even with the browser closed.
- **Passive Chromium cache import (`discrawl wiretap`):** Because Chromium browsers and Discord Desktop share Chromium's cache format, `discrawl wiretap --path <BrowserProfileDir>` passively imports cached Discord message payloads into SQLite (`discrawl.db`) without making network requests. Note that passive cache import only sees channels already loaded by your browser session.
