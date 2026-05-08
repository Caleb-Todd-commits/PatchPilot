#!/usr/bin/env node
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import {
  DEFAULT_TEST_COMMAND,
  demoSourcePath,
  demoWorkspacePath,
  hasOpenAIKey,
  loadDotEnv,
  requireOpenAIKey,
  type PatchPilotMode
} from "./config.js";
import { runPatchPilot, resetDemoWorkspace } from "./pipeline.js";

loadDotEnv();

const program = new Command();

program
  .name("patchpilot")
  .description("AI verified-fix agent for small JavaScript and TypeScript repos.")
  .version("0.1.0");

program
  .command("run")
  .description("Run PatchPilot against a local repo and markdown bug report.")
  .requiredOption("--repo <path>", "target repo path")
  .requiredOption("--issue <path>", "markdown bug report path inside the repo")
  .requiredOption("--test <command>", "test command to run inside the repo")
  .option("--offline", "use deterministic canned outputs instead of OpenAI")
  .action(async (options: { repo: string; issue: string; test: string; offline?: boolean }) => {
    const mode: PatchPilotMode = options.offline ? "offline" : "live";
    try {
      requireOpenAIKey(mode);
      const result = await runPatchPilot({
        repoPath: options.repo,
        issuePath: options.issue,
        testCommand: options.test,
        mode
      });
      process.exitCode = result.finalStatus === "passed" ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program
  .command("demo")
  .description("Reset and run the included demo repo.")
  .option("--offline", "use deterministic canned outputs instead of OpenAI")
  .action(async (options: { offline?: boolean }) => {
    const mode: PatchPilotMode = options.offline ? "offline" : "live";
    if (mode === "live" && !hasOpenAIKey()) {
      console.error("Live demo requires OPENAI_API_KEY. Run npm run demo:offline for the deterministic demo.");
      process.exitCode = 1;
      return;
    }

    try {
      requireOpenAIKey(mode);
      const workspacePath = demoWorkspacePath();
      await resetDemoWorkspace(demoSourcePath(), workspacePath);
      const result = await runPatchPilot({
        repoPath: workspacePath,
        issuePath: path.join(workspacePath, "issues", "empty-cart.md"),
        testCommand: DEFAULT_TEST_COMMAND,
        mode
      });
      process.exitCode = result.finalStatus === "passed" ? 0 : 1;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

program
  .command("inspect-runs")
  .description("Show the latest PatchPilot run artifacts.")
  .option("--repo <path>", "repo path", demoWorkspacePath())
  .action(async (options: { repo: string }) => {
    const latestDir = path.join(path.resolve(options.repo), ".patchpilot", "runs", "latest");
    const tracePath = path.join(latestDir, "trace.json");

    try {
      const trace = JSON.parse(await readFile(tracePath, "utf8")) as {
        runId: string;
        finalStatus: string;
        mode: string;
        completedAt: string;
      };
      console.log(`Latest run: ${trace.runId}`);
      console.log(`Mode: ${trace.mode}`);
      console.log(`Status: ${trace.finalStatus}`);
      console.log(`Completed: ${trace.completedAt}`);
      console.log(`Artifacts: ${latestDir}`);
    } catch {
      console.log(`No latest run found at ${latestDir}`);
      process.exitCode = 1;
    }
  });

program.parseAsync();
