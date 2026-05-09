# Live OpenAI Verification

Live mode was run against the included demo repo with a local `OPENAI_API_KEY`.

## Empty Cart

```text
Scenario: empty-cart
✔ Live OpenAI mode enabled
✔ Using model: gpt-4.1-mini
✔ OpenAI file selection completed
✔ OpenAI regression test generated
✖ Confirmed regression test fails before fix
✔ OpenAI implementation patch generated
✔ Applied implementation patch
✔ Tests passed after fix

PatchPilot Summary
Verdict: PASS
Mode: live
Changed files: tests/cart.test.ts, src/cart.ts
```

## Tax Discount Order

```text
Scenario: tax-discount-order
✔ Live OpenAI mode enabled
✔ Using model: gpt-4.1-mini
✔ OpenAI file selection completed
✔ OpenAI regression test generated
✖ Confirmed regression test fails before fix
✔ OpenAI implementation patch generated
✔ Applied implementation patch
✔ Tests passed after fix

PatchPilot Summary
Verdict: PASS
Mode: live
Changed files: tests/cart.test.ts, src/cart.ts
```

## What This Proves

- PatchPilot can call the OpenAI Responses API in live mode.
- `trace.json` records `mode: "live"`, `model: "gpt-4.1-mini"`, and the OpenAI call list.
- Model outputs validate through the same Zod schemas used by offline mode.
- Live AI decisions still flow through deterministic file writes, baseline test execution, generated regression failure, final test pass, and persisted artifacts.
- No API keys or live secrets are committed; `.env` is ignored and `.env.example` remains blank.
