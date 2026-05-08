import type { FileSelection } from "../schemas/fileSelection.js";
import type { ImplementationPatch } from "../schemas/implementationPatch.js";
import type { RegressionTest } from "../schemas/regressionTest.js";

type ReportArgs = {
  finalStatus: "passed" | "failed";
  issueText: string;
  selection?: FileSelection;
  regression?: RegressionTest;
  implementation?: ImplementationPatch;
  baselinePassed: boolean;
  beforeFailed: boolean;
  afterPassed: boolean;
  baselineExitCode?: number;
  beforeExitCode?: number;
  afterExitCode?: number;
};

function summarizeIssue(issueText: string): string {
  const lines = issueText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return lines.slice(0, 2).join(" ") || "No bug report summary was available.";
}

function fencedCode(language: string, content: string): string {
  return `\`\`\`${language}\n${content.trimEnd()}\n\`\`\``;
}

export function writeRepairReport({
  finalStatus,
  issueText,
  selection,
  regression,
  implementation,
  baselinePassed,
  beforeFailed,
  afterPassed,
  baselineExitCode,
  beforeExitCode,
  afterExitCode
}: ReportArgs): string {
  const relevantFiles =
    selection?.relevantFiles.map((file) => `- ${file.path} (${file.role}): ${file.reason}`).join("\n") ||
    "- No relevant files were selected.";

  const filesChanged = [regression?.file, implementation?.file]
    .filter(Boolean)
    .filter((file, index, all) => all.indexOf(file) === index)
    .map((file) => `- ${file}`)
    .join("\n");

  const sourceFile = implementation?.file ?? "implementation file";
  const rootCause = implementation
    ? `The failing behavior came from ${sourceFile}: ${implementation.rationale}`
    : "PatchPilot did not reach implementation planning, so no root cause was confirmed.";

  return `# PatchPilot Repair Report

## Verdict
${finalStatus === "passed" ? "PASS" : "FAIL"}

## Bug Report
${summarizeIssue(issueText)}

## Root Cause
${rootCause}

## AI Decisions
${relevantFiles}
- Regression test generated: ${regression ? `${regression.testName} in ${regression.file}` : "not generated"}
- Implementation patched: ${implementation ? `${implementation.file} (${implementation.rationale})` : "not patched"}

## Red-Green Verification
- Baseline test suite passed before changes: ${baselinePassed ? "yes" : "no"}${baselineExitCode === undefined ? "" : ` (exit ${baselineExitCode})`}
- Regression test failed before fix: ${beforeFailed ? "yes" : "no"}${beforeExitCode === undefined ? "" : ` (exit ${beforeExitCode})`}
- Test suite passed after fix: ${afterPassed ? "yes" : "no"}${afterExitCode === undefined ? "" : ` (exit ${afterExitCode})`}
- Baseline evidence: test-baseline.txt
- Failure evidence: test-before.txt
- Passing evidence: test-after.txt

## Files Changed
${filesChanged || "- No files changed."}

## Generated Regression Test
${regression ? `Test: ${regression.testName}\nFile: ${regression.file}\n\n${regression.rationale}\n\n${fencedCode("ts", regression.newFileContent)}` : "No regression test was generated."}

## Implementation Fix
${implementation ? `${implementation.rationale}\n\n${fencedCode("ts", implementation.newFileContent)}` : "No implementation fix was applied."}

## Reviewer Notes
- PatchPilot only rewrote the selected test file and implementation file.
- Original files were backed up under .patchpilot/backups for this run.
- No commits, pushes, or PR comments were created automatically.

## Artifacts
- trace.json
- report.md
- test-baseline.txt
- test-before.txt
- test-after.txt
- generated-test.diff
- implementation.diff
- learned-regression.json

## Why AI Was Necessary
Scripts can run tests, but AI is needed to interpret ambiguous bug reports, select relevant files, create a regression test, and map failure output to an implementation fix.
`;
}
