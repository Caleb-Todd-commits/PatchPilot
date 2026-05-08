import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PatchPilotMode = "live" | "offline";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

export const PROJECT_ROOT = path.resolve(currentDir, "..");
export const DEFAULT_MODEL = "gpt-4.1-mini";
export const DEFAULT_TEST_COMMAND = "npm test";

export function loadDotEnv(root = PROJECT_ROOT): void {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [rawKey, ...rawValueParts] = trimmed.split("=");
    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function demoSourcePath(): string {
  return path.join(PROJECT_ROOT, "demo-repo");
}

export function demoWorkspacePath(): string {
  return path.join(PROJECT_ROOT, ".tmp", "demo-workspace");
}
