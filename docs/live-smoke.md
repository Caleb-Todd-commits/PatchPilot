# Live OpenAI Smoke Test

Live mode was run against the included demo repo with a local `OPENAI_API_KEY`.

Result:

```text
PatchPilot Summary
Verdict: PASS
Mode: live
Changed files: tests/cart.test.ts, src/cart.ts
Artifacts: .tmp/demo-workspace/.patchpilot/runs/latest
```

What this proves:

- PatchPilot can call the OpenAI Responses API in live mode.
- Model outputs validate through the same Zod schemas used by offline mode.
- Live AI decisions still flow through deterministic file writes, baseline test execution, generated regression failure, final test pass, and persisted artifacts.
- No API keys or live secrets are committed; `.env` is ignored and `.env.example` remains blank.
