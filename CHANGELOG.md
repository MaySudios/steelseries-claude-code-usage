# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
