/**
 * Annotated default configuration written by `sscu config init`. Kept as a
 * hand-written template (rather than serialized defaults) so users get inline
 * documentation. It must stay in sync with {@link ConfigSchema} defaults.
 */
export const CONFIG_TEMPLATE = `# steelseries-claude-code-usage configuration
# Docs: https://github.com/MaySudios/steelseries-claude-code-usage
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
burnScaleTokensPerMin: 3000   # burn rate that maps to 100% on the burn gauge/pulse
usageWarnPct: 70              # block headroom % that turns indicators amber
usageCriticalPct: 90          # ...and red

# --- OLED screen --------------------------------------------------------------
# Lines use \${metric.id} placeholders. Available ids:
#   block.cost  block.timeLeft  block.usagePct  block.tokens
#   block.burnRate  block.burnPct  block.projCost  block.projTokens
#   today.cost  today.tokens  month.cost  cache.hitPct
#   model.current  model.level
#   plan.<id>  plan.<id>.reset   (only when planLimits.enabled)
oled:
  enabled: true
  deviceType: screened        # "screened" (any) or "screened-128x40" (Apex Pro/7)
  rotateSeconds: 4            # seconds per screen (0 = never rotate)
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
# type: pulse      - one colour that flashes faster as the value rises
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
      minHz: 1
      maxHz: 8
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
