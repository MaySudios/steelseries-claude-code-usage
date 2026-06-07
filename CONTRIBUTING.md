# Contributing

Thanks for your interest in improving **steelseries-claude-code-usage**!

## Development setup

```bash
git clone https://github.com/MaySudios/steelseries-claude-code-usage.git
cd steelseries-claude-code-usage
npm install
npm run check     # typecheck + lint + test
```

Useful scripts:

| Script                              | Purpose                               |
| ----------------------------------- | ------------------------------------- |
| `npm test` / `npm run test:watch`   | Run the Vitest suite                  |
| `npm run test:coverage`             | Coverage report (thresholds enforced) |
| `npm run typecheck`                 | `tsc --noEmit`                        |
| `npm run lint` / `npm run lint:fix` | ESLint                                |
| `npm run format`                    | Prettier                              |
| `npm run build`                     | Bundle to `dist/` with tsup           |
| `npm run dev -- <args>`             | Run the CLI from source (`tsx`)       |

## Architecture

The project is a hexagonal (ports & adapters) design — please keep the layering:

- **`src/domain`** — pure types and functions. **No I/O, no Node APIs.**
- **`src/application`** — services orchestrating the domain; depend only on `domain/ports.ts`.
- **`src/infrastructure`** — adapters that implement the ports (Claude JSONL, LiteLLM pricing, GameSense client/handlers, config, logging, clock).
- **`src/composition`** — the only place that wires concrete adapters together.
- **`src/cli`** — argument parsing and command handlers.

If a change makes the application layer import from `infrastructure`, it's in the wrong place — add a port instead.

## Tests

This project is test‑driven. New behaviour needs tests:

- Pure logic → unit tests against the function/class.
- Adapters → either a fake transport/reader (see `test/gamesense/fake-transport.ts`) or a temp‑dir integration test (see `test/claude/jsonl-usage-source.test.ts`).
- Keep tests timezone‑robust (derive expectations from the computed value where block/aggregation math depends on local time).

## Pull requests

1. Branch from `main`.
2. `npm run check` must pass (typecheck + lint + tests).
3. Keep changes focused; update `docs/` and the README when behaviour changes.
4. Conventional, descriptive commit messages are appreciated.

## Reporting issues

Include your OS, SteelSeries device, `sscu --version`, and the output of `sscu doctor`. For rendering issues, the SteelSeries Engine log helps:
`%PROGRAMDATA%\SteelSeries\SteelSeries Engine 3\Logs\golisp-log.txt` (Windows).

## License

By contributing you agree your contributions are licensed under the project's [Apache‑2.0](./LICENSE) license.
