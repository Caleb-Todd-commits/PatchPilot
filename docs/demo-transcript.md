# Demo Transcript

Use this as the outline for a 60-90 second screen recording.

## 1. Show The Bug Report

Open:

```text
demo-repo/issues/empty-cart.md
```

The report says `calculateTotal([])` should return `0`, but empty carts crash total calculation.

## 2. Run The Offline Demo

```bash
npm run demo:offline
```

Expected terminal flow:

```text
✔ Loaded bug report
✔ Inspected repo
✔ Baseline tests passed before changes
✔ Selected relevant files
✔ Generated regression test
✖ Confirmed regression test fails before fix
✔ Applied implementation patch
✔ Tests passed after fix
✔ Report written to .../.tmp/demo-workspace/.patchpilot/runs/latest/report.md

PatchPilot Summary
Verdict: PASS
Mode: offline
Changed files: tests/cart.test.ts, src/cart.ts
Artifacts: .../.tmp/demo-workspace/.patchpilot/runs/latest
```

## 3. Show The Proof

Open:

```text
.tmp/demo-workspace/.patchpilot/runs/latest/test-baseline.txt
.tmp/demo-workspace/.patchpilot/runs/latest/test-before.txt
.tmp/demo-workspace/.patchpilot/runs/latest/test-after.txt
.tmp/demo-workspace/.patchpilot/runs/latest/generated-test.diff
.tmp/demo-workspace/.patchpilot/runs/latest/implementation.diff
.tmp/demo-workspace/.patchpilot/runs/latest/report.md
.tmp/demo-workspace/.patchpilot/runs/latest/trace.json
```

The important thing is not the canned offline AI output. The important thing is that PatchPilot executes the real system loop:

1. proves the starting test suite is green
2. writes the generated regression test
3. runs the repo test command and captures the expected failure
4. writes the implementation patch
5. reruns the same test command and captures the pass
6. writes `trace.json`, diffs, `learned-regression.json`, and a PR-ready report

## 4. Optional: Show The Quality Gate

```bash
npm run quality
```

This runs the build, unit tests, both offline demo scenarios, and latest-run inspection in one command. In CI, `scripts/write-ci-summary.mjs` also validates the generated trace and required artifacts before writing the GitHub Actions summary.

## 5. Optional: Show The Tax/Discount Scenario

```bash
npm run demo:offline:tax-discount-order
```

This demonstrates that PatchPilot can select a small cluster of relevant modules instead of only one obvious file. The bug report says checkout totals must apply discount before tax and round the final total. PatchPilot selects `src/cart.ts`, `src/discounts.ts`, `src/tax.ts`, and `tests/cart.test.ts`, generates the 37.87 regression test, confirms it fails, patches the order of operations, and verifies the full suite passes.
