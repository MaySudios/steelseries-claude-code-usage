# Configuration reference

`sscu` reads a single YAML (or JSON) file. Generate an annotated starting point with:

```bash
sscu config init        # writes to the platform default path
sscu config path        # show where that is
```

Resolution order: `--config <path>` → `$SSCU_CONFIG` → platform default
(`%APPDATA%\steelseries-claude-usage\config.yaml` on Windows, `~/.config/steelseries-claude-usage/config.yaml` elsewhere).

Every field is optional; omit it to use the default. Unknown top‑level keys are rejected so typos surface immediately.

## Top‑level

| Key                     | Type                           | Default             | Notes                                                                                             |
| ----------------------- | ------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------- |
| `game`                  | string                         | `CLAUDE_CODE_USAGE` | GameSense game id. **UPPERCASE** `A–Z 0–9 _ -` only.                                              |
| `displayName`           | string                         | `Claude Code Usage` | Shown in SteelSeries GG.                                                                          |
| `developer`             | string                         | `MaySudios`         | Shown in SteelSeries GG.                                                                          |
| `pollIntervalSeconds`   | number (1–3600)                | `10`                | How often usage data is re‑read. Raise it if you are an extreme power user with huge transcripts. |
| `costMode`              | `auto`\|`calculate`\|`display` | `auto`              | See [Cost modes](#cost-modes).                                                                    |
| `offlinePricing`        | boolean                        | `false`             | Never fetch live pricing; use the bundled table. (Also via `--offline`.)                          |
| `sessionLengthHours`    | number (1–24)                  | `5`                 | Billing‑block length.                                                                             |
| `lookbackDays`          | number (0–3650)                | `35`                | Ignore transcripts older than this (keeps polling fast). `0` = no limit.                          |
| `currencySymbol`        | string                         | `$`                 | Cosmetic prefix for money values.                                                                 |
| `recentWindowMinutes`   | number (0–120)                 | `5`                 | Window for the **live burn rate** (tokens in the last N min). `0` = no idle‑off.                  |
| `burnScaleTokensPerMin` | number                         | `50000`             | Burn rate that maps to 100 % on the burn gauge/pulse.                                             |
| `usageWarnPct`          | number (0–100)                 | `70`                | Headroom % that turns indicators **amber**.                                                       |
| `usageCriticalPct`      | number (0–100)                 | `90`                | Headroom % that turns indicators **red**.                                                         |

### Cost modes

- **`auto`** — use Claude Code's own `costUSD` when a line has it, otherwise compute from tokens × pricing.
- **`calculate`** — always compute from tokens × pricing (ignore `costUSD`).
- **`display`** — only show Claude Code's own `costUSD` (lines without it count as `$0`).

Pricing comes from the [LiteLLM dataset](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) (cached). When offline or unreachable, a bundled per‑family table is used (Opus/Sonnet/Haiku), so brand‑new model versions still price sensibly.

## `oled`

| Key             | Type            | Default      | Notes                                                                                     |
| --------------- | --------------- | ------------ | ----------------------------------------------------------------------------------------- |
| `enabled`       | boolean         | `true`       |                                                                                           |
| `deviceType`    | string          | `screened`   | `screened` matches any OLED; use `screened-128x40` to target the Apex Pro/7 specifically. |
| `rotateSeconds` | number (0–3600) | `4`          | Default seconds per screen. `0` = never rotate (always the first screen).                 |
| `screens`       | array           | (4 built‑in) | Each screen is **text** or **image** (see below).                                         |

A **text** screen has `lines: string[]` (templates with `${metric.id}` placeholders — see [Metrics](#metrics)), an optional built‑in `icon` (drawn in the left 32 px), an optional `title`, and an optional `seconds` (its own rotation duration). The Apex Pro OLED comfortably fits **two** short rows.

An **image** screen has `image` — either the built‑in `claude` logo or a path to a `.pbm` bitmap (centered onto 128×40) — plus optional `title`/`seconds`.

Built‑in icon names: `money`, `clock`, `timer`, `lightning`/`bolt`, `cpu`, `gpu`, `ram`, `music`, `play`, `pause`, `health`, `mana`, `temperature`, … (or a numeric id 0–43).

> Custom per‑pixel icons _beside_ text are a GameSense limitation — use a built‑in `icon`, or a full‑screen `image` screen for a logo. `sscu preview` shows exactly what renders.

```yaml
oled:
  enabled: true
  rotateSeconds: 4
  screens:
    - { title: Logo, image: claude, seconds: 3 }
    - title: Live block
      icon: money
      seconds: 6
      lines:
        - '5h ${block.cost}  ${block.timeLeft}'
        - 'use ${block.usagePct}  ${block.tokens}'
    - { title: Splash, image: ~/my-logo.pbm }
```

## `keys`

| Key        | Type    | Default      | Notes                    |
| ---------- | ------- | ------------ | ------------------------ |
| `enabled`  | boolean | `true`       |                          |
| `bindings` | array   | (3 built‑in) | One per‑key effect each. |

Each binding has: `id` (alphanumeric/underscore, also becomes the GameSense event suffix), `metric` (which metric's 0–100 `percent` drives it), `keys` (array of key names or HID codes), and a `type`:

### `type: gauge`

Fills more keys as the value rises, coloured along a gradient.

```yaml
- id: headroom
  type: gauge
  metric: block.usagePct
  keys: [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12]
  from: '#00ff00' # value 0
  to: '#ff0000' # value 100
```

### `type: threshold`

Solid colour chosen by value bands; optional flash above a level.

```yaml
- id: alert
  type: threshold
  metric: block.usagePct
  keys: [printscreen]
  bands: # inclusive upper bounds; last is stretched to 100
    - { upTo: 50, color: '#00ff00' }
    - { upTo: 80, color: '#ffbf00' }
    - { upTo: 100, color: '#ff0000' }
  flash: { atOrAbove: 95, hz: 4 } # optional
```

### `type: pulse`

Dark below `idleBelow`, then a calm pulse scaling from `minHz` to `maxHz`. Paired
with the recent‑window burn metric, this means the key is **off when idle** and
pulses only while Claude is generating. Set `steady: true` to light up solid
(no flashing) instead.

```yaml
- id: burn
  type: pulse
  metric: block.burnPct
  keys: [scrolllock]
  color: '#8000ff'
  minHz: 1 # just above idle
  maxHz: 2 # at full burn (kept calm)
  idleBelow: 5 # dark below this value
  steady: false # true = solid colour when active
```

### Key names

Letters `a`–`z`, digits `0`–`9`, `f1`–`f12`, `space`/`spacebar`, `enter`/`return`, `esc`, `tab`, `backspace`, `caps`, `minus`, `equal`, `lbracket`, `rbracket`, `backslash`, `semicolon`, `quote`, `backquote`, `comma`, `period`, `slash`, `printscreen`, `scrolllock`, `pause`, `insert`, `home`, `pageup`, `delete`, `end`, `pagedown`, `up`/`uparrow`, `down`, `left`, `right`, modifiers `lctrl`/`lshift`/`lalt`/`lwin`/`rctrl`/`rshift`/`ralt`/`rwin`. You may also use raw **USB HID usage codes** (integers 0–255).

> The order of `keys` is the fill order for `gauge` (and `count`) — list them left‑to‑right for a natural bar.

## Metrics

| id                            | Has `percent`? | Meaning                                      |
| ----------------------------- | -------------- | -------------------------------------------- |
| `block.cost`                  | –              | Active 5‑hour block cost                     |
| `block.timeLeft`              | –              | Time remaining in the active block           |
| `block.usagePct`              | ✓              | Block tokens vs your historical peak block   |
| `block.tokens`                | –              | Tokens used in the active block              |
| `block.burnRate`              | ✓              | Tokens/min (text)                            |
| `block.burnPct`               | ✓              | Burn rate scaled to 0–100                    |
| `block.projCost`              | –              | Projected block cost at current rate         |
| `block.projTokens`            | –              | Projected block tokens                       |
| `today.cost` / `today.tokens` | –              | Today's totals                               |
| `month.cost`                  | –              | This month's total                           |
| `cache.hitPct`                | ✓              | Cache‑read ratio (today)                     |
| `model.current`               | –              | Current model family label                   |
| `model.level`                 | ✓              | Opus 90 · Sonnet 50 · Haiku 20 · idle 0      |
| `plan.<id>`                   | ✓              | Plan utilization (when `planLimits.enabled`) |
| `plan.<id>.reset`             | –              | Time until that plan window resets           |

Bindings (`gauge`/`threshold`/`pulse`) require a metric that has a `percent`.

## `planLimits` (experimental, opt‑in)

| Key               | Type    | Default                       | Notes                                                     |
| ----------------- | ------- | ----------------------------- | --------------------------------------------------------- |
| `enabled`         | boolean | `false`                       | Surface subscription utilization (5h/weekly/Opus/Sonnet). |
| `credentialsPath` | string  | `~/.claude/.credentials.json` | Where to read the OAuth token.                            |

When enabled, `plan.*` metrics become available (e.g. `plan.five-hour`, `plan.seven-day`, `plan.seven-day-opus`). This requires network and reads your own token; see the README's Privacy section.

## Full example

The file written by `sscu config init` is the canonical, fully‑annotated example. A copy lives at [`examples/config.full.yaml`](../examples/config.full.yaml), with a stripped‑down [`examples/config.minimal.yaml`](../examples/config.minimal.yaml).
