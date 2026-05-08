import { access, copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeRelativePath, resolveInside, toPosixPath } from "./safety.js";

const EXCLUDED_DIRS = new Set([
  ".git",
  ".patchpilot",
  ".tmp",
  "coverage",
  "dist",
  "node_modules"
]);

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readRepoFile(repoPath: string, relativePath: string): Promise<string> {
  const safePath = resolveInside(repoPath, relativePath);
  return readFile(safePath, "utf8");
}

export async function listRepoFiles(repoPath: string): Promise<string[]> {
  const root = path.resolve(repoPath);
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(root, absolutePath));

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }

  await walk(root);
  return files.sort();
}

export async function readRepoSnippets(
  repoPath: string,
  files: string[],
  maxCharsPerFile = 3500
): Promise<Array<{ path: string; content: string }>> {
  const snippets = [];

  for (const file of files) {
    const safeFile = assertSafeRelativePath(repoPath, file);
    try {
      const content = await readRepoFile(repoPath, safeFile);
      snippets.push({
        path: safeFile,
        content: content.length > maxCharsPerFile ? `${content.slice(0, maxCharsPerFile)}\n...` : content
      });
    } catch {
      continue;
    }
  }

  return snippets;
}

export async function prepareLatestRunArtifacts(repoPath: string): Promise<string> {
  const latestDir = path.join(path.resolve(repoPath), ".patchpilot", "runs", "latest");
  await rm(latestDir, { recursive: true, force: true });
  await mkdir(latestDir, { recursive: true });
  return latestDir;
}

export async function writeArtifact(repoPath: string, fileName: string, content: string): Promise<string> {
  const artifactPath = resolveInside(repoPath, path.join(".patchpilot", "runs", "latest", fileName));
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, content, "utf8");
  return artifactPath;
}

export async function writeJsonArtifact(repoPath: string, fileName: string, data: unknown): Promise<string> {
  return writeArtifact(repoPath, fileName, `${JSON.stringify(data, null, 2)}\n`);
}

export async function writeRepoFileWithBackup(
  repoPath: string,
  relativePath: string,
  newContent: string,
  runId: string
): Promise<{ absolutePath: string; previousContent: string; existed: boolean }> {
  const safeRelativePath = assertSafeRelativePath(repoPath, relativePath);
  const absolutePath = resolveInside(repoPath, safeRelativePath);
  const existed = await pathExists(absolutePath);
  let previousContent = "";

  if (existed) {
    previousContent = await readFile(absolutePath, "utf8");
    const backupPath = resolveInside(repoPath, path.join(".patchpilot", "backups", runId, safeRelativePath));
    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(absolutePath, backupPath);
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, newContent, "utf8");

  return { absolutePath, previousContent, existed };
}

export async function ensureDirectory(filePath: string): Promise<void> {
  const info = await stat(filePath);
  if (!info.isDirectory()) {
    throw new Error(`Expected a directory: ${filePath}`);
  }
}
