# Signal Radar tools

## 1. Built-in Browser (`browser`, `profile: "user"`)

Primary zero-install path for users who keep Discord open in Chrome, Brave, or Edge:
- Check readiness with `browser({ action: "status", profile: "user" })` and `browser({ action: "tabs", profile: "user" })`.
- Reuse an existing `discord.com` tab; do not spawn background windows or touch non-Discord tabs.
- Navigate sequentially only to the user's configured channel URLs in `state/config.json` (at most 6 channels per pass) using `browser({ action: "navigate", profile: "user", ... })` and read visible messages via `browser({ action: "text", profile: "user" })` or `browser({ action: "snapshot", profile: "user" })`.
- Strictly read-only: never invoke `act` to type, send, react, or modify Discord state.

## 2. Deterministic Signal Engine (`scripts/signal-engine.mjs`)

Run via `exec`:
- Analyze a captured slice against `state/config.json` and `state/cursors.json`:
  `node scripts/signal-engine.mjs --input captures/<channel>.txt --channel <channel> --config state/config.json --cursors state/cursors.json --out captures/<channel>.analysis.json`
- Commit the updated watermark **after** saving and verifying the report:
  `node scripts/signal-engine.mjs --mode commit-cursor --analysis captures/<channel>.analysis.json --cursors state/cursors.json`

## 3. Optional `discrawl` CLI (`exec`)

When `discrawl` is installed on the host (`sourceMode: "discrawl"` or `"hybrid"`):
- Refresh local cache passively when configured: `discrawl wiretap` (or `discrawl wiretap --path <browserProfileDir>`), or check `discrawl status --json`.
- Export structured channel slices: `DISCRAWL_NO_AUTO_UPDATE=1 discrawl --json messages --channel <idOrName> --hours <n> --all` and feed the JSON output directly into `scripts/signal-engine.mjs`.
- Query direct structural mentions: `DISCRAWL_NO_AUTO_UPDATE=1 discrawl --json mentions --target <handle>`.

## 4. Scheduler (`automations`)

Manages only this agent's `signal-radar` and `daily-brief` jobs per `references/automation.md`.
