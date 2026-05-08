import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeRelativePath, relativeToRepo, resolveInside } from "../src/tools/safety.js";

describe("repo path safety", () => {
  const repoPath = path.resolve("/tmp/patchpilot-demo");

  it("allows paths inside the target repo", () => {
    expect(assertSafeRelativePath(repoPath, "src/cart.ts")).toBe("src/cart.ts");
    expect(resolveInside(repoPath, "tests/cart.test.ts")).toBe(path.join(repoPath, "tests/cart.test.ts"));
  });

  it("blocks path traversal outside the target repo", () => {
    expect(() => resolveInside(repoPath, "../outside.ts")).toThrow(/Blocked unsafe path/);
    expect(() => assertSafeRelativePath(repoPath, "/tmp/not-the-repo/file.ts")).toThrow(/Blocked unsafe path/);
  });

  it("normalizes absolute in-repo paths back to repo-relative paths", () => {
    const absolutePath = path.join(repoPath, "issues", "empty-cart.md");
    expect(relativeToRepo(repoPath, absolutePath)).toBe("issues/empty-cart.md");
  });
});
