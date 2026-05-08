import { mkdir, readFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { getOpenAIModel, requireOpenAIKey, type PatchPilotMode } from "./config.js";
import { selectRelevantFiles } from "./agents/fileSelector.js";
import { planImplementationPatch } from "./agents/patchPlanner.js";
import { writeRegressionTest } from "./agents/regressionTestWriter.js";
import { writeRepairReport } from "./agents/reportWriter.js";
import type { FileSelection } from "./schemas/fileSelection.js";
import type { ImplementationPatch } from "./schemas/implementationPatch.js";
import type { RegressionTest } from "./schemas/regressionTest.js";
import { listRepoFiles, prepareLatestRunArtifacts, writeArtifact, writeJsonArtifact, writeRepoFileWithBackup } from "./tools/fsTools.js";
import { createFileRewriteDiff } from "./tools/patchTools.js";
import { resolveInside, relativeToRepo } from "./tools/safety.js";
import { runTestCommand, type TestRunResult } from "./tools/testRunner.js";
import { TraceRecorder } from "./tools/trace.js";

export type PipelineOptions = {
  repoPath: string;
  issuePath: string;
  testCommand: string;
  mode: PatchPilotMode;
};

export type PipelineResult = {
  finalStatus: "passed" | "failed";
  artifactsDir: string;
  runId: string;
};

function createRunId(): string {
  return `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

function printStep(symbol: "✔" | "✖", message: string): void {
  console.log(`${symbol} ${message}`);
}

function printRunSummary(args: {
  mode: PatchPilotMode;
  finalStatus: "passed" | "failed";
  artifactsDir: string;
  changedFiles: string[];
}): void {
  console.log("");
  console.log("PatchPilot Summary");
  console.log(`Verdict: ${args.finalStatus === "passed" ? "PASS" : "FAIL"}`);
  console.log(`Mode: ${args.mode}`);
  console.log(`Changed files: ${args.changedFiles.length ? args.changedFiles.join(", ") : "none"}`);
  console.log(`Artifacts: ${args.artifactsDir}`);
}

function preview(text: string, maxLength = 500): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function isInsidePath(rootPath: string, targetPath: string): boolean {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function resolveIssuePath(repoPath: string, issuePath: string): string {
  const issueFromCwd = path.resolve(issuePath);
  if (isInsidePath(repoPath, issueFromCwd)) {
    return issueFromCwd;
  }

  return resolveInside(repoPath, issuePath);
}

async function writeEmptyArtifactSet(repoPath: string): Promise<void> {
  await writeArtifact(repoPath, "test-baseline.txt", "");
  await writeArtifact(repoPath, "test-before.txt", "");
  await writeArtifact(repoPath, "test-after.txt", "");
  await writeArtifact(repoPath, "generated-test.diff", "");
  await writeArtifact(repoPath, "implementation.diff", "");
  await writeJsonArtifact(repoPath, "learned-regression.json", {});
}

async function saveTrace(repoPath: string, trace: TraceRecorder, finalStatus: "passed" | "failed"): Promise<void> {
  const snapshot = trace.complete(finalStatus);
  await writeJsonArtifact(repoPath, "trace.json", snapshot);
}

export async function runPatchPilot(options: PipelineOptions): Promise<PipelineResult> {
  requireOpenAIKey(options.mode);
  const model = getOpenAIModel();
  if (options.mode === "live") {
    printStep("✔", "Live OpenAI mode enabled");
    printStep("✔", `Using model: ${model}`);
  } else {
    printStep("✔", "Offline deterministic mode enabled");
    printStep("✔", "Using canned structured outputs");
    printStep("✔", "No OpenAI API key required");
  }

  const repoPath = path.resolve(options.repoPath);
  const issueAbsolutePath = resolveIssuePath(repoPath, options.issuePath);
  const issueRelativePath = relativeToRepo(repoPath, issueAbsolutePath);
  const runId = createRunId();
  const artifactsDir = await prepareLatestRunArtifacts(repoPath);
  const trace = new TraceRecorder(runId, options.mode, issueRelativePath, repoPath, options.mode === "live" ? model : undefined);

  let issueText = "";
  let selection: FileSelection | undefined;
  let regression: RegressionTest | undefined;
  let implementation: ImplementationPatch | undefined;
  let baselineRun: TestRunResult | undefined;
  let beforeRun: TestRunResult | undefined;
  let afterRun: TestRunResult | undefined;
  let baselinePassed = false;
  let beforeFailed = false;
  let afterPassed = false;

  await writeEmptyArtifactSet(repoPath);

  try {
    issueText = await trace.measure("read_bug_report", options.issuePath, async () => {
      const content = await readFile(issueAbsolutePath, "utf8");
      return {
        summary: "Loaded bug report markdown.",
        output: { issuePath: issueRelativePath },
        value: content
      };
    });
    printStep("✔", "Loaded bug report");

    const files = await trace.measure("inspect_repo", repoPath, async () => {
      const repoFiles = await listRepoFiles(repoPath);
      return {
        summary: `Inspected ${repoFiles.length} repo files.`,
        output: { fileCount: repoFiles.length },
        value: repoFiles
      };
    });
    printStep("✔", "Inspected repo");

    baselineRun = await (async () => {
      const startedAt = Date.now();
      const result = await runTestCommand(repoPath, options.testCommand);
      await writeArtifact(repoPath, "test-baseline.txt", result.output);
      trace.addStep({
        name: "run_baseline_tests",
        status: result.passed ? "passed" : "failed",
        summary: result.passed
          ? "Baseline test command passed before PatchPilot changes."
          : "Baseline test command failed before PatchPilot changes.",
        inputPreview: options.testCommand,
        output: {
          command: result.command,
          exitCode: result.exitCode,
          passed: result.passed
        },
        durationMs: Date.now() - startedAt
      });
      return result;
    })();
    baselinePassed = baselineRun.passed;

    if (baselinePassed) {
      printStep("✔", "Baseline tests passed before changes");
    } else {
      printStep("✖", "Baseline tests failed before changes");
      const report = writeRepairReport({
        finalStatus: "failed",
        issueText,
        baselinePassed,
        beforeFailed,
        afterPassed,
        baselineExitCode: baselineRun.exitCode
      });
      await writeArtifact(repoPath, "report.md", report);
      await writeJsonArtifact(repoPath, "learned-regression.json", {
        bugPattern: "baseline test suite failed before PatchPilot changed files",
        regressionTest: null,
        filesChanged: [],
        fixPattern: null,
        futureSignal: "repair agents should stop when the starting test suite is already red"
      });
      await saveTrace(repoPath, trace, "failed");
      printRunSummary({
        mode: options.mode,
        finalStatus: "failed",
        artifactsDir,
        changedFiles: []
      });
      return { finalStatus: "failed", artifactsDir, runId };
    }

    selection = await trace.measure("select_files", preview(issueText), async () => {
      const selected = await selectRelevantFiles({
        mode: options.mode,
        repoPath,
        issueText,
        files
      });
      return {
        summary: `Selected ${selected.relevantFiles.length} relevant files.`,
        output: selected,
        value: selected
      };
    });
    if (options.mode === "live") {
      trace.recordOpenAICall("file_selection");
      printStep("✔", "OpenAI file selection completed");
    } else {
      printStep("✔", "Selected relevant files");
    }
    const selectedFiles = selection;

    regression = await trace.measure("generate_regression_test", preview(issueText), async () => {
      const generated = await writeRegressionTest({
        mode: options.mode,
        repoPath,
        issueText,
        selection: selectedFiles
      });
      return {
        summary: `Generated regression test ${generated.testName}.`,
        output: {
          file: generated.file,
          testName: generated.testName,
          rationale: generated.rationale
        },
        value: generated
      };
    });
    if (options.mode === "live") {
      trace.recordOpenAICall("regression_test_generation");
      printStep("✔", "OpenAI regression test generated");
    } else {
      printStep("✔", "Generated regression test");
    }
    const generatedRegression = regression;

    await trace.measure("apply_regression_test", generatedRegression.file, async () => {
      const writeResult = await writeRepoFileWithBackup(
        repoPath,
        generatedRegression.file,
        generatedRegression.newFileContent,
        runId
      );
      const diff = createFileRewriteDiff(
        generatedRegression.file,
        writeResult.previousContent,
        generatedRegression.newFileContent
      );
      await writeArtifact(repoPath, "generated-test.diff", diff);
      return {
        summary: `Applied regression test rewrite to ${generatedRegression.file}.`,
        output: { file: generatedRegression.file, backupCreated: writeResult.existed },
        value: undefined
      };
    });

    beforeRun = await (async () => {
      const startedAt = Date.now();
      const result = await runTestCommand(repoPath, options.testCommand);
      await writeArtifact(repoPath, "test-before.txt", result.output);
      trace.addStep({
        name: "run_tests_before_fix",
        status: result.passed ? "passed" : "failed",
        summary: result.passed
          ? "Test command passed unexpectedly after regression test."
          : "Test command failed as expected after regression test.",
        inputPreview: options.testCommand,
        output: {
          command: result.command,
          exitCode: result.exitCode,
          passed: result.passed
        },
        durationMs: Date.now() - startedAt
      });
      return result;
    })();
    beforeFailed = !beforeRun.passed;

    if (beforeFailed) {
      printStep("✖", "Confirmed regression test fails before fix");
    } else {
      printStep("✖", "Regression test did not fail before fix");
      trace.addStep({
        name: "apply_implementation_patch",
        status: "skipped",
        summary: "Skipped implementation patch because the regression test was not red."
      });
      const report = writeRepairReport({
        finalStatus: "failed",
        issueText,
        selection: selectedFiles,
        regression: generatedRegression,
        baselinePassed,
        beforeFailed,
        afterPassed,
        baselineExitCode: baselineRun.exitCode,
        beforeExitCode: beforeRun.exitCode
      });
      await writeArtifact(repoPath, "report.md", report);
      await writeJsonArtifact(repoPath, "learned-regression.json", {
        bugPattern: "regression test did not reproduce the reported bug",
        regressionTest: generatedRegression.testName,
        filesChanged: [generatedRegression.file],
        fixPattern: null,
        futureSignal: "a generated regression must fail before implementation changes are trusted",
        issuePath: issueRelativePath,
        testFile: generatedRegression.file,
        failureConfirmed: false,
        fixed: false
      });
      await saveTrace(repoPath, trace, "failed");
      printRunSummary({
        mode: options.mode,
        finalStatus: "failed",
        artifactsDir,
        changedFiles: [generatedRegression.file]
      });
      return { finalStatus: "failed", artifactsDir, runId };
    }

    implementation = await trace.measure("generate_patch", beforeRun.output.slice(0, 2000), async () => {
      const generated = await planImplementationPatch({
        mode: options.mode,
        repoPath,
        issueText,
        selection: selectedFiles,
        testOutput: beforeRun?.output ?? ""
      });
      return {
        summary: `Generated implementation patch for ${generated.file}.`,
        output: {
          file: generated.file,
          strategy: generated.strategy,
          rationale: generated.rationale
        },
        value: generated
      };
    });
    if (options.mode === "live") {
      trace.recordOpenAICall("implementation_patch_generation");
      printStep("✔", "OpenAI implementation patch generated");
    }
    const generatedImplementation = implementation;

    await trace.measure("apply_implementation_patch", generatedImplementation.file, async () => {
      const writeResult = await writeRepoFileWithBackup(
        repoPath,
        generatedImplementation.file,
        generatedImplementation.newFileContent,
        runId
      );
      const diff = createFileRewriteDiff(
        generatedImplementation.file,
        writeResult.previousContent,
        generatedImplementation.newFileContent
      );
      await writeArtifact(repoPath, "implementation.diff", diff);
      return {
        summary: `Applied implementation rewrite to ${generatedImplementation.file}.`,
        output: { file: generatedImplementation.file, backupCreated: writeResult.existed },
        value: undefined
      };
    });
    printStep("✔", "Applied implementation patch");

    afterRun = await (async () => {
      const startedAt = Date.now();
      const result = await runTestCommand(repoPath, options.testCommand);
      await writeArtifact(repoPath, "test-after.txt", result.output);
      trace.addStep({
        name: "run_tests_after_fix",
        status: result.passed ? "passed" : "failed",
        summary: result.passed ? "Test command passed after fix." : "Test command failed after fix.",
        inputPreview: options.testCommand,
        output: {
          command: result.command,
          exitCode: result.exitCode,
          passed: result.passed
        },
        durationMs: Date.now() - startedAt
      });
      return result;
    })();
    afterPassed = afterRun.passed;

    if (afterPassed) {
      printStep("✔", "Tests passed after fix");
    } else {
      printStep("✖", "Tests failed after fix");
    }

    const finalStatus = beforeFailed && afterPassed ? "passed" : "failed";
    await writeJsonArtifact(repoPath, "learned-regression.json", {
      bugPattern: "empty collection reduce without initial value",
      regressionTest: generatedRegression.testName,
      filesChanged: [generatedImplementation.file, generatedRegression.file],
      fixPattern: "provide initial accumulator value to reduce",
      futureSignal: "watch for reduce calls without initial values on arrays that may be empty",
      issuePath: issueRelativePath,
      selectedFiles: selectedFiles.relevantFiles,
      testName: generatedRegression.testName,
      testFile: generatedRegression.file,
      implementationFile: generatedImplementation.file,
      failureConfirmed: beforeFailed,
      fixed: afterPassed
    });

    const report = writeRepairReport({
      finalStatus,
      issueText,
      selection: selectedFiles,
      regression: generatedRegression,
      implementation: generatedImplementation,
      baselinePassed,
      beforeFailed,
      afterPassed,
      baselineExitCode: baselineRun.exitCode,
      beforeExitCode: beforeRun.exitCode,
      afterExitCode: afterRun.exitCode
    });
    await writeArtifact(repoPath, "report.md", report);
    printStep("✔", `Report written to ${path.join(artifactsDir, "report.md")}`);
    printRunSummary({
      mode: options.mode,
      finalStatus,
      artifactsDir,
      changedFiles: [generatedRegression.file, generatedImplementation.file].filter(
        (file, index, all) => all.indexOf(file) === index
      )
    });

    await saveTrace(repoPath, trace, finalStatus);
    return { finalStatus, artifactsDir, runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace.addStep({
      name: "pipeline_error",
      status: "failed",
      summary: message
    });

    const report = writeRepairReport({
      finalStatus: "failed",
      issueText,
      selection,
      regression,
      implementation,
      baselinePassed,
      beforeFailed,
      afterPassed
    });
    await writeArtifact(repoPath, "report.md", report);
    await saveTrace(repoPath, trace, "failed");
    throw error;
  }
}

export async function resetDemoWorkspace(sourcePath: string, workspacePath: string): Promise<void> {
  await rm(workspacePath, { recursive: true, force: true });
  await mkdir(path.dirname(workspacePath), { recursive: true });
  await cp(sourcePath, workspacePath, { recursive: true });
}
