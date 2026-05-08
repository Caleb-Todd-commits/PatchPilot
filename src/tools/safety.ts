import path from "node:path";

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function resolveInside(repoPath: string, requestedPath: string): string {
  const repoRoot = path.resolve(repoPath);
  const targetPath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(repoRoot, requestedPath);

  if (targetPath !== repoRoot && !targetPath.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Blocked unsafe path outside repo: ${requestedPath}`);
  }

  return targetPath;
}

export function relativeToRepo(repoPath: string, targetPath: string): string {
  const repoRoot = path.resolve(repoPath);
  const absoluteTarget = resolveInside(repoRoot, targetPath);
  return toPosixPath(path.relative(repoRoot, absoluteTarget));
}

export function assertSafeRelativePath(repoPath: string, requestedPath: string): string {
  const absolutePath = resolveInside(repoPath, requestedPath);
  const relativePath = path.relative(path.resolve(repoPath), absolutePath);

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Blocked unsafe repo path: ${requestedPath}`);
  }

  return toPosixPath(relativePath);
}
