# Judges Guide

## Run

Fast deterministic demo, no API key:

```bash
npm install
npm run demo:offline
```

Second deterministic scenario:

```bash
npm run demo:offline:tax-discount-order
```

Full local quality gate:

```bash
npm run quality
```

Live OpenAI demo:

```bash
cp .env.example .env
# add OPENAI_API_KEY to .env
npm run demo
```

Optional live tax/discount scenario:

```bash
npm run demo:tax-discount-order
```

## Inspect

Open:

```text
.tmp/demo-workspace/.patchpilot/runs/latest/report.md
.tmp/demo-workspace/.patchpilot/runs/latest/trace.json
.tmp/demo-workspace/.patchpilot/runs/latest/test-baseline.txt
.tmp/demo-workspace/.patchpilot/runs/latest/test-before.txt
.tmp/demo-workspace/.patchpilot/runs/latest/test-after.txt
.tmp/demo-workspace/.patchpilot/runs/latest/generated-test.diff
.tmp/demo-workspace/.patchpilot/runs/latest/implementation.diff
.tmp/demo-workspace/.patchpilot/runs/latest/learned-regression.json
```

## What Proves It Is A System

- natural-language bug report is the input
- baseline tests pass before any file changes
- PatchPilot selects relevant files from a small repo with decoys
- the optional tax/discount scenario selects across cart, discounts, and tax modules
- PatchPilot writes a generated regression test
- the generated regression test fails before the implementation fix
- PatchPilot writes the implementation patch
- the same test command passes after the fix
- trace, test output, diffs, learned regression, and report are persisted
- CI validates the generated trace and required artifacts before publishing the workflow summary

## What Proves OpenAI Is Used

`npm run demo` uses live OpenAI mode for file selection, regression test generation, and implementation patch generation. The terminal prints the enabled model and each OpenAI decision point as it completes. `trace.json` records `mode`, `model`, and `openaiCalls` without logging the API key.

The model outputs are validated with Zod before PatchPilot writes files. Sanitized sample live artifacts are checked in under `docs/sample-live-run/`. `npm run demo:offline` is the reproducibility demo and does not require an API key.

## Why Offline Mode Exists

Offline mode lets judges verify the system mechanics quickly and deterministically without creating an API key: baseline tests, generated regression failure, implementation patch, final passing tests, trace, diffs, learned regression, and report generation.

## Known Limitations

- MVP focused on small JavaScript/TypeScript repos
- full-file rewrite strategy for demo reliability
- patches should be reviewed
- no auto-commit or PR creation
- no web UI, database, vector search, or multi-language support
