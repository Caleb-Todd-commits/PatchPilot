# PatchPilot Submission Brief

## What PatchPilot Is

PatchPilot is an AI verified-fix agent for small JavaScript and TypeScript repos. It turns a natural-language bug report into a failing regression test, patches the implementation, reruns the test suite, and writes a PR-ready repair report.

The project is intentionally scoped as a CLI system. There is no web UI, database, vector search, PR automation, or multi-language framework.

## Core Claim

PatchPilot is not a prompt wrapper. A prompt wrapper asks an AI to suggest a fix. PatchPilot runs a deterministic verification loop around structured AI decisions:

1. Reads a markdown bug report.
2. Inspects the repo.
3. Runs baseline tests before making changes.
4. Uses OpenAI, or offline canned outputs, to select relevant files.
5. Generates and writes a regression test.
6. Runs the real test command and confirms the regression fails.
7. Generates and writes an implementation patch.
8. Reruns the real test command and confirms the fix passes.
9. Saves test logs, diffs, trace data, learned regression data, and a repair report.

## Included Scenarios

### Empty Cart

Bug report: `demo-repo/issues/empty-cart.md`

Problem: `calculateTotal([])` should return `0`, but the implementation assumes at least one cart item and crashes for an empty array.

Expected proof:

- baseline tests pass
- generated empty-cart regression test fails
- implementation patch adds a safe initial accumulator
- final tests pass

### Tax Discount Order

Bug report: `demo-repo/issues/tax-discount-order.md`

Problem: checkout totals apply tax before discount. The business rule is subtotal, discount, clamp, tax, then final rounding.

Expected case:

```text
items = [{ price: 19.99, quantity: 2 }]
discount = 5.00
taxRate = 0.0825
final total = 37.87
```

Expected proof:

- PatchPilot selects `src/cart.ts`, `src/discounts.ts`, `src/tax.ts`, and `tests/cart.test.ts`
- generated regression test expects `37.87`
- first test run fails with the wrong total
- implementation patch applies discount before tax
- final tests pass

## What To Run

Fast deterministic verification:

```bash
npm install
npm run demo:offline
```

Second deterministic verification scenario:

```bash
npm run demo:offline:tax-discount-order
```

Full local quality gate:

```bash
npm run quality
```

Live OpenAI verification:

```bash
cp .env.example .env
# Add OPENAI_API_KEY=your_key_here
npm run demo
```

## What To Inspect

After any run, inspect:

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

## CI Proof

GitHub Actions runs both deterministic scenarios, validates each generated `trace.json`, checks that all required artifacts exist, writes a step summary, and uploads artifact bundles for judge inspection.

## Safety And Reviewability

- model outputs are validated with Zod before file writes
- paths are constrained to the target repo
- only the configured test command is executed
- original files are backed up under `.patchpilot/backups`
- no commits, pushes, or PR comments are created automatically
- `.env` is ignored and API keys are never written to artifacts
