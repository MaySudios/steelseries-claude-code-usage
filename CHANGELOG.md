# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] — 2026-06-08

### Fixed

- **0.3.1 broke the GG "Configure" page.** Removing the game on every `connect()`
  wiped GG state and could leave its config UI broken. Reverted: the daemon now
  registers once and leaves it (the pattern real GameSense apps use).

### Added

- **`sscu reset`** — removes the app from SteelSeries GG on demand (the clean,
  user-controlled way to clear stale events, replacing the automatic remove).

## [0.3.1] — 2026-06-08

Polish for how the app appears in SteelSeries GG, based on inspecting the
Engine's own database and how real third-party OLED apps (TIDAL, Spotify,
Discord, System Monitor) register.

### Added

- **Event icons in GG** — each event now carries a built-in `icon_id` (config
  `iconId` per key binding + `oled.iconId`), like TIDAL/Discord. Defaults:
  headroom=money, burn=lightning, alert=flash.
- **Optional OLED icon** — `oled.iconId > 0` draws an icon next to the text
  (TIDAL's exact flat `icon-id` + `lines` pattern). Off by default (it consumes
  the left 32 px).

### Fixed

- **Stale events lingering in GG.** `connect()` now calls `/remove_game` first,
  so old events from a previous version (e.g. the removed `OLEDIMG`) no longer
  clutter the GG event list.

### Note

- A custom app **logo** and **friendly per-event display names** (e.g. CS2's
  "Round Over") are **not available to third-party GameSense apps** — confirmed
  by the SDK (closed issue #12) and the Engine DB (only partner games like
  CSGO/DOTA2 have a CDN `app_logo_url`; TIDAL/Spotify/Discord do not). We match
  the achievable third-party tier: clean name + developer + event icons.

## [0.3.0] — 2026-06-08

Verified live on real Apex Pro hardware: text + per-key RGB render reliably;
raw bitmaps do not.

### Removed

- **Image/logo screens and per-screen icons.** Dynamic OLED bitmaps and
  icon-beside-text do not render across SteelSeries firmware (confirmed on real
  hardware; GameSense SDK issues #119/#61). The bitmap/PBM/image code was removed
  rather than shipped non-working — the OLED is now text only, which is exactly
  what real GameSense OLED apps use.

### Changed

- OLED rendering reworked from research on real GameSense OLED apps: one text
  event whose frame changes, sending only the active page each tick (pages fully
  replace, never stack). Max 2 lines (3+ can crash the Engine).
- `sscu preview` now renders screens as plain boxed text + the colored key list.

### Kept

- Rotating multi-line text screens with per-screen `seconds`.
- Calm, real-time burn indicator; per-key gauge/threshold/pulse.
- Native configuration inside SteelSeries GG (Screen + Illumination tabs).

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
