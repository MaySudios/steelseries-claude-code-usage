/**
 * Annotated default configuration written by `sscu config init`. Kept as a
 * hand-written template (rather than serialized defaults) so users get inline
 * documentation. It must stay in sync with {@link ConfigSchema} defaults.
 */
export const CONFIG_TEMPLATE = `# steelseries-claude-code-usage configuration
# Docs: https://github.com/MaySudios/steelseries-claude-code-usage
# Tip: run \`sscu preview\` to see your screens + key colours in the terminal.
#
# Everything here is optional — delete any line to fall back to its default.

# GameSense game id (UPPERCASE A-Z, 0-9, hyphen, underscore).
game: CLAUDE_CODE_USAGE
displayName: Claude Code Usage
developer: MaySudios

# How often to refresh, in seconds.
pollIntervalSeconds: 10

# Cost accounting:
#   auto      - use Claude Code's own cost when present, else compute from tokens
#   calculate - always compute from tokens x pricing
#   display   - only show Claude Code's own cost
costMode: auto
# Never fetch live model pricing from the network (use the bundled table).
offlinePricing: false

# Billing block length (Claude subscriptions meter against a rolling window).
sessionLengthHours: 5
# Ignore transcripts older than this many days (keeps each poll fast).
lookbackDays: 35

# Cosmetic / thresholds.
currencySymbol: "$"
# Live burn rate: tokens counted over the last N minutes (0 disables idle-off).
recentWindowMinutes: 5
# Tokens/min that maps to 100% on the burn gauge/pulse.
burnScaleTokensPerMin: 50000
usageWarnPct: 70   # block headroom % that turns indicators amber
usageCriticalPct: 90  # ...and red

# --- OLED screens -------------------------------------------------------------
# Each screen is up to 2 lines of text (the 128x40 OLED renders ~2 rows).
# Lines use \${metric.id} placeholders. Available ids:
#   block.cost  block.timeLeft  block.usagePct  block.tokens
#   block.burnRate  block.burnPct  block.projCost  block.projTokens
#   today.cost  today.tokens  month.cost  cache.hitPct
#   model.current  model.level
#   plan.<id>  plan.<id>.reset   (only when planLimits.enabled)
# seconds: how long a screen shows before rotating (defaults to rotateSeconds).
# (Images/icons are intentionally not supported — GameSense does not render raw
#  bitmaps or icons-beside-text reliably across firmware; text is what works.)
oled:
  enabled: true
  deviceType: screened        # OLED device type ("screened" matches any)
  rotateSeconds: 4            # default seconds per screen (0 = never rotate)
  screens:
    - title: Live block
      lines:
        - "5h \${block.cost}  \${block.timeLeft}"
        - "use \${block.usagePct}  \${block.tokens}"
    - title: Burn
      lines:
        - "burn \${block.burnRate}"
        - "proj \${block.projCost}"
    - title: Totals
      lines:
        - "today \${today.cost}"
        - "month \${month.cost}"

# --- Per-key RGB --------------------------------------------------------------
# Each binding reads a metric's 0-100 value and lights "keys" (HID names/codes).
# type: gauge      - fills more keys as the value rises (gradient from -> to)
# type: threshold  - solid colour by value bands, optional flash above a level
# type: pulse      - dark while idle, then pulses (calm by default); set
#                    "steady: true" to just light up solid when active.
keys:
  enabled: true
  bindings:
    - id: headroom
      type: gauge
      metric: block.usagePct
      keys: [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12]
      from: "#00ff00"
      to: "#ff0000"
    - id: burn
      type: pulse
      metric: block.burnPct
      keys: [scrolllock]
      color: "#8000ff"
      minHz: 1            # flash speed just above idle
      maxHz: 2            # ...and at full burn (kept calm)
      idleBelow: 5        # value below which the key stays dark
      steady: false       # true = solid colour when active instead of pulsing
    - id: alert
      type: threshold
      metric: block.usagePct
      keys: [printscreen]
      bands:
        - { upTo: 50, color: "#00ff00" }
        - { upTo: 80, color: "#ffbf00" }
        - { upTo: 100, color: "#ff0000" }
      flash: { atOrAbove: 95, hz: 4 }

# --- Plan limits (optional, Lucxar-style) ------------------------------------
# When enabled, reads your Claude OAuth token and fetches subscription
# utilization (5h / weekly / Opus / Sonnet). Off by default; needs network.
planLimits:
  enabled: false
  # credentialsPath: ~/.claude/.credentials.json
`;
