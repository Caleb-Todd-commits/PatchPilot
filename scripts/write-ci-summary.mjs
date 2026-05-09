import { existsSync, readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

const artifactsDir = process.argv[2] ?? ".tmp/demo-workspace/.patchpilot/runs/latest";
const requiredArtifacts = [
  "trace.json",
  "report.md",
  "generated-test.diff",
  "implementation.diff",
  "test-baseline.txt",
  "test-before.txt",
  "test-after.txt",
  "learned-regression.json"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Could not parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const artifact of requiredArtifacts) {
  const artifactPath = path.join(artifactsDir, artifact);
  if (!existsSync(artifactPath)) {
    fail(`Missing PatchPilot artifact: ${artifactPath}`);
  }
}

const trace = readJson(path.join(artifactsDir, "trace.json"));
const steps = new Map((trace.steps ?? []).map((step) => [step.name, step]));

function requireStepStatus(name, status) {
  const step = steps.get(name);
  if (!step) {
    fail(`Trace is missing step: ${name}`);
  }
  if (step.status !== status) {
    fail(`Trace step ${name} expected ${status}, got ${step.status}`);
  }
  return step;
}

requireStepStatus("run_baseline_tests", "passed");
requireStepStatus("run_tests_before_fix", "failed");
requireStepStatus("apply_implementation_patch", "passed");
requireStepStatus("run_tests_after_fix", "passed");

if (trace.finalStatus !== "passed") {
  fail(`Trace finalStatus expected passed, got ${trace.finalStatus}`);
}

const summary = `# PatchPilot Demo Result

| Stage | Result |
|---|---|
| Baseline tests | PASS |
| Generated regression test | FAIL as expected |
| Implementation patch | APPLIED |
| Final tests | PASS |

Artifacts:
${requiredArtifacts.map((artifact) => `- ${artifact}`).join("\n")}
`;

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  console.log(summary);
}
