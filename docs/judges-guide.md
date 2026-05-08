# Judges Guide

## Run

Fast demo, no API key:

```bash
npm install
npm run demo:offline
```

Live OpenAI demo:

```bash
cp .env.example .env
# add OPENAI_API_KEY to .env
npm run demo
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
- PatchPilot writes a generated regression test
- the generated regression test fails before the implementation fix
- PatchPilot writes the implementation patch
- the same test command passes after the fix
- trace, test output, diffs, learned regression, and report are persisted

## What Proves OpenAI Is Used

`npm run demo` uses live OpenAI mode for file selection, regression test generation, and implementation patch generation. The terminal prints the enabled model and each OpenAI decision point as it completes. `trace.json` records `mode`, `model`, and `openaiCalls` without logging the API key.

The model outputs are validated with Zod before PatchPilot writes files. `npm run demo:offline` is the reproducibility demo and does not require an API key.

## Known Limitations

- MVP focused on small JavaScript/TypeScript repos
- full-file rewrite strategy for demo reliability
- patches should be reviewed
- no auto-commit or PR creation
- no web UI, database, vector search, or multi-language support
