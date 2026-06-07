# Security policy

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories
("Report a vulnerability" on the repository's **Security** tab) rather than a
public issue. We aim to acknowledge reports within a few days.

## Scope & design notes

This tool is **local‑first** by design:

- It reads Claude Code usage transcripts (`~/.claude/projects/**/*.jsonl`) from
  your own machine and turns them into numbers. **Transcripts never leave the
  machine.**
- Outbound network requests are limited to:
  1. Public model **pricing** from the LiteLLM dataset (disable with `--offline`).
  2. **Only if you explicitly enable `planLimits`:** your own subscription usage
     from Anthropic's API, authenticated with your own local OAuth token. The
     token is read locally, sent only to `api.anthropic.com`, and never logged.

If you believe any of these properties is violated, that is a security issue —
please report it.
