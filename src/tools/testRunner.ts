import path from "node:path";
import { execaCommand } from "execa";
import { PROJECT_ROOT } from "../config.js";

export type TestRunResult = {
  command: string;
  exitCode: number;
  passed: boolean;
  output: string;
  durationMs: number;
};

export async function runTestCommand(repoPath: string, command: string): Promise<TestRunResult> {
  const startedAt = Date.now();
  const rootBinPath = path.join(PROJECT_ROOT, "node_modules", ".bin");
  const pathValue = [rootBinPath, process.env.PATH].filter(Boolean).join(path.delimiter);

  const result = await execaCommand(command, {
    cwd: repoPath,
    reject: false,
    all: true,
    env: {
      ...process.env,
      PATH: pathValue
    }
  });

  return {
    command,
    exitCode: result.exitCode ?? 1,
    passed: result.exitCode === 0,
    output: result.all || "",
    durationMs: Date.now() - startedAt
  };
}
