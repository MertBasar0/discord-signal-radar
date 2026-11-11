# Scheduled Radar & Daily Brief Automations

Native OpenClaw automations are the sole scheduler. The Template manifest declares both `automations` entries paused by default (`enabled: false`) so no unconfigured job fires before onboarding completes.

Instantiate both recipes **disabled** (`enabled: false`) during first-run setup once the user confirms their IANA timezone:

1. **`signal-radar` (`automations/signal-radar.json`):**
   - Default cadence: every 2 hours during waking hours (`0 9-23/2 * * *` in the user's timezone).
   - Focuses on personal mentions, untagged mentions of the user's projects, and high-importance breaking discussions. Returns `NO_REPLY` whenever `shouldNotify` is `false`.
2. **`daily-brief` (`automations/daily-brief.json`):**
   - Default cadence: once daily at `09:30` (`30 9 * * *` in the user's timezone).
   - Produces the structured daily digest across all configured channels since the previous watermark.

## Lifecycle rules

- Check existing jobs assigned to this agent before creating; reuse and update any existing job matching `signal-radar` or `daily-brief` rather than creating duplicates.
- Store the returned job IDs in `state/config.json` (`automations.signalRadarJobId` and `automations.dailyBriefJobId`).
- Read back schedule, timezone, `enabled` state, and `delivery` after any create/update call.
- Enable a job **only** when the user explicitly asks to enable scheduled monitoring.
