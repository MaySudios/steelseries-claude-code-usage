# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-06-08

### Fixed
- **OLED rendered blank by default in 0.2.0.** Enabling per-screen icons (a
  range-based screen handler with `icon-id` next to multi-line text) and a logo
  image event stacked on the same screen were accepted by GameSense but did not
  render. The default OLED is back to the proven plain multi-line text rotation.
  Icons and image/logo screens remain available but are now **opt-in** and
  documented as device-dependent (use `sscu preview` to check).

## [0.2.0] — 2026-06-08

### Added

- **Terminal preview** — `sscu preview` renders every OLED screen as half-block
  art (with current data) plus a colour overview of the per-key bindings, so you
  can design without looking at the keyboard.
- **OLED icons** — per-screen built-in icon (`money`, `clock`, `lightning`, …).
- **Image / logo screens** — a built-in `claude` splash plus custom `.pbm`
  bitmaps, mixed freely into the rotation.
- **Per-screen timing** — each screen can set its own `seconds`, giving full
  control over the rotation sequence and loop.

### Changed

- **Calmer, real-time burn indicator** — the burn metric now uses a recent-window
  token rate (`recentWindowMinutes`, default 5) instead of the block average, so
  the key is dark when idle and pulses only while Claude is generating. The pulse
  defaults are gentle (1–2 Hz) and configurable (`minHz`/`maxHz`/`idleBelow`),
  with a new `steady: true` option to just light up solid.
- `burnScaleTokensPerMin` default raised to 50000 to suit the recent-rate model.

## [0.1.0] — 2026-06-07

Initial release.

### Added

- Local Claude Code usage reader (parses `~/.claude/projects/**/*.jsonl`, dedupes
  by `message.id:requestId`, with mtime caching for cheap repeated polls).
- Cost engine with `auto` / `calculate` / `display` modes, LiteLLM live pricing
  and an offline per‑family fallback table.
- 5‑hour billing blocks with burn rate, projection and headroom‑vs‑peak.
- Metric resolver + OLED templating and per‑key RGB `gauge` / `threshold` /
  `pulse` bindings.
- GameSense client, OLED screen + per‑key colour handler builders, coreProps
  discovery, and a `Display` adapter.
- Configurable via annotated YAML/JSON (`zod`‑validated).
- Optional, opt‑in Anthropic plan‑limit utilization source.
- CLI: `run`, `once`, `stats`, `doctor`, `test-display`, `config init/path`.
