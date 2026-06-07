# steelseries-claude-code-usage

> Live **Claude Code** usage, cost and 5‑hour‑block burn rate on your **SteelSeries Apex Pro** OLED and per‑key RGB — via the GameSense™ SDK.

[![CI](https://github.com/MaySudios/steelseries-claude-code-usage/actions/workflows/ci.yml/badge.svg)](https://github.com/MaySudios/steelseries-claude-code-usage/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen.svg)](#requirements)

This is the keyboard answer to [Lucxar's Stream Deck plugin](https://github.com/Lucxar/elgato-streamdeck-claude-code-usage): a small daemon that reads the usage data Claude Code already writes on your machine and renders it on your keyboard's **OLED screen** and **per‑key RGB** — fully configurable, like a Discord notification plugin, but for your AI spend.

```
┌────────────────────────────┐
│ 5h $4.21    2h13m          │   ← Apex Pro OLED (128×40)
│ use 43%     612k           │
└────────────────────────────┘
   F1 F2 F3 F4 …  ████░░░░  ← per-key "headroom" gauge fills + reddens as you near your block ceiling
```

---

## Why

If you live in Claude Code, you have no ambient sense of how much you're burning until you check. This puts the important numbers where you already look — your keyboard:

- **Current 5‑hour block cost** and **time left** in the window.
- **Headroom** vs your historical peak block (the "am I about to hit my ceiling" gauge).
- **Burn rate** (tokens/min) and a **projected** block total.
- **Today** and **this month** totals.
- Optional **plan‑limit utilization** (5h / weekly / Opus / Sonnet), Lucxar‑style.

Everything is **local‑first**: it parses the same `~/.claude/projects/**/*.jsonl` transcripts that [`ccusage`](https://github.com/ryoppippi/ccusage) reads. No account, no network, no telemetry required.

## Features

- 🖥️ **OLED screens** — multiple, rotating, fully templated text lines.
- 🌈 **Per‑key RGB** — `gauge` (bar across keys), `threshold` (severity colour + flash), and `pulse` (flash speed scales with burn rate).
- 🧮 **Accurate cost** — the ccusage cost model (4 token classes × per‑model pricing), with `auto`/`calculate`/`display` modes.
- ⏱️ **5‑hour blocks** — burn rate, projection, and headroom‑vs‑peak.
- 🔌 **Offline‑capable** — bundled pricing fallback; live [LiteLLM](https://github.com/BerriAI/litellm) pricing when online.
- ⚙️ **Configurable** — a single annotated YAML/JSON file decides what shows where.
- 🧪 **Tested** — 140+ unit tests, clean hexagonal architecture (SOLID/DRY/KISS).
- 🖱️ **Cross‑platform** — Windows & macOS (anywhere SteelSeries Engine runs).

## Requirements

- A **SteelSeries device** driven by **SteelSeries GG / Engine 3** (the OLED features target the **Apex Pro / Apex 7 / TKL**, `screened-128x40`; per‑key RGB targets any `rgb-per-key-zones` keyboard). Other GameSense devices still work for the RGB metrics.
- **SteelSeries GG running** (it exposes the local GameSense server).
- **Node.js ≥ 18.17**.
- **Claude Code** installed and used (so there is usage data to read).

> Don't have an OLED? Disable it in config (`oled.enabled: false`) and use the per‑key RGB metrics only — or vice‑versa.

## Install

```bash
npm install -g steelseries-claude-code-usage
# or run without installing:
npx steelseries-claude-code-usage doctor
```

The package installs two identical binaries: **`sscu`** (short) and `steelseries-claude-usage`.

## Quick start

```bash
sscu doctor          # check Engine, Claude data and config are detected
sscu stats           # print the numbers to your terminal (no device needed)
sscu config init     # write an annotated config you can edit
sscu run             # start the daemon — watch your keyboard
```

`Ctrl+C` stops the daemon and restores your normal lighting.

## Commands

| Command                      | What it does                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `sscu run`                   | Start the daemon (default command).                                     |
| `sscu once`                  | Push a single frame and exit (handy for testing).                       |
| `sscu stats [--json]`        | Print computed metrics to stdout — no keyboard required.                |
| `sscu doctor`                | Diagnose the environment (Engine, Claude data, config, sample numbers). |
| `sscu test-display`          | Blink a self‑test pattern so you can see OLED + RGB working.            |
| `sscu config init [--force]` | Write the annotated config template.                                    |
| `sscu config path`           | Print where the config is (or would be).                                |

**Global options:** `-c, --config <path>` · `--offline` (never fetch pricing) · `-v, --verbose` · `-q, --quiet` · `-h, --help` · `-V, --version`.

Config path resolution: `--config` → `$SSCU_CONFIG` → platform default (`%APPDATA%\steelseries-claude-usage\config.yaml` on Windows, `~/.config/steelseries-claude-usage/config.yaml` elsewhere).

## Configuration

Run `sscu config init` then edit the file. Every field is optional — omit one to take its default. See **[docs/CONFIGURATION.md](./docs/CONFIGURATION.md)** for the full reference; the short version:

```yaml
pollIntervalSeconds: 10
costMode: auto # auto | calculate | display
sessionLengthHours: 5

oled:
  enabled: true
  rotateSeconds: 4 # cycle screens every N seconds
  screens:
    - lines: ['5h ${block.cost}  ${block.timeLeft}', 'use ${block.usagePct}  ${block.tokens}']
    - lines: ['burn ${block.burnRate}', 'proj ${block.projCost}']

keys:
  enabled: true
  bindings:
    - {
        id: headroom,
        type: gauge,
        metric: block.usagePct,
        keys: [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12],
        from: '#00ff00',
        to: '#ff0000',
      }
    - { id: burn, type: pulse, metric: block.burnPct, keys: [scrolllock], color: '#8000ff' }
    - {
        id: alert,
        type: threshold,
        metric: block.usagePct,
        keys: [printscreen],
        bands:
          [
            { upTo: 50, color: '#00ff00' },
            { upTo: 80, color: '#ffbf00' },
            { upTo: 100, color: '#ff0000' },
          ],
        flash: { atOrAbove: 95, hz: 4 },
      }
```

### OLED line templates

Lines are plain text with `${metric.id}` placeholders.

### Metrics

| id                                    | Meaning                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `block.cost`                          | Cost of the active 5‑hour block                                           |
| `block.timeLeft`                      | Time remaining in the active block                                        |
| `block.usagePct`                      | Block token usage vs your historical peak block (0–100)                   |
| `block.tokens`                        | Tokens used in the active block                                           |
| `block.burnRate`                      | Tokens per minute                                                         |
| `block.burnPct`                       | Burn rate scaled to 0–100 (for gauges/pulses)                             |
| `block.projCost` / `block.projTokens` | Projected block total at the current rate                                 |
| `today.cost` / `today.tokens`         | Today's totals                                                            |
| `month.cost`                          | This month's total                                                        |
| `cache.hitPct`                        | Cache‑read ratio (cheap‑token efficiency)                                 |
| `model.current`                       | Current model family (Opus/Sonnet/Haiku)                                  |
| `model.level`                         | Numeric model level for `threshold` keys (Opus 90 · Sonnet 50 · Haiku 20) |
| `plan.<id>` / `plan.<id>.reset`       | Plan utilization & reset (only when `planLimits.enabled`)                 |

### Per‑key binding types

- **`gauge`** — fills more keys as the value rises, coloured along a `from → to` gradient.
- **`threshold`** — solid colour by value `bands`, with an optional `flash` above a level.
- **`pulse`** — one `color` that flashes faster as the value rises (`minHz`–`maxHz`).

**Keys** accept friendly names (`a`–`z`, `0`–`9`, `f1`–`f12`, `space`, `enter`, `esc`, `tab`, arrows, `scrolllock`, `printscreen`, `insert`, …) or raw USB HID codes.

## How it works

```
Claude Code transcripts          SteelSeries Engine
 ~/.claude/projects/*.jsonl        (local GameSense HTTP server)
         │                                  ▲
         ▼                                  │ /game_event (OLED frame + key values)
  JsonlUsageSource ──► CostCalculator ──► MetricResolver ──► GameSenseDisplay
  (parse + dedup)      BlockCalculator     (named metrics)   (handlers + heartbeat)
```

The codebase is a clean hexagonal architecture: a pure **domain** (tokens, cost, blocks, metrics), an **application** layer of services (cost, aggregation, blocks, snapshot, resolver, the daemon), **infrastructure** adapters (Claude JSONL, LiteLLM pricing, GameSense client/handlers, config), and a small **composition** root. The orchestrator depends only on ports, so the whole pipeline is unit‑tested with fakes.

## Plan limits (experimental, opt‑in)

Set `planLimits.enabled: true` to additionally surface subscription utilization (5h / weekly / Opus / Sonnet), the way Lucxar's plugin does. This reads your Claude OAuth token from `~/.claude/.credentials.json` and queries Anthropic's usage endpoint. It is **off by default**, requires network, and is best‑effort (the endpoint is undocumented); any failure simply omits the plan metrics and the local telemetry continues.

## Run at login

- **Windows:** create a Task Scheduler task running `sscu run` at logon (delay ~30 s so SteelSeries GG is up first), or use [`pm2`](https://pm2.keymetrics.io/): `pm2 start sscu -- run`.
- **macOS:** a LaunchAgent running `sscu run`, or `pm2 start sscu -- run && pm2 save`.

## Privacy & security

- Usage **transcripts never leave your machine** — they are read locally and turned into numbers.
- The only outbound requests are: model **pricing** from the public LiteLLM dataset (skippable with `--offline`), and — **only if you enable plan limits** — your own usage from Anthropic's API using your own token. The token is never logged or sent anywhere else.

## Development

```bash
npm install
npm run check      # typecheck + lint + test
npm run build
node dist/cli/index.js doctor
```

Tech: TypeScript (strict), Vitest, tsup, ESLint/Prettier, `zod` for config validation.

## Trademarks & disclaimer

This is an independent, community project. It is **not** affiliated with or endorsed by SteelSeries ApS or Anthropic PBC. "SteelSeries", "Apex Pro" and "GameSense" are trademarks of SteelSeries ApS; "Claude" and "Claude Code" are trademarks of Anthropic PBC. See [NOTICE](./NOTICE).

## License

[Apache‑2.0](./LICENSE) © MaySudios.
