import type { PatchPilotMode } from "../config.js";
import type { FileSelection } from "../schemas/fileSelection.js";
import { RegressionTestSchema, type RegressionTest } from "../schemas/regressionTest.js";
import { readRepoSnippets } from "../tools/fsTools.js";
import { assertSafeRelativePath } from "../tools/safety.js";
import { generateStructured } from "../openaiClient.js";

type WriteRegressionTestArgs = {
  mode: PatchPilotMode;
  repoPath: string;
  issueText: string;
  selection: FileSelection;
};

const OFFLINE_TEST_CONTENT = `import { describe, expect, it } from "vitest";
import { calculateTotal } from "../src/cart";

describe("calculateTotal", () => {
  it("calculates totals for normal carts", () => {
    expect(
      calculateTotal([
        { price: 12, quantity: 2 },
        { price: 5, quantity: 3 }
      ])
    ).toBe(39);
  });

  it("returns 0 for an empty cart", () => {
    expect(calculateTotal([])).toBe(0);
  });
});
`;

export async function writeRegressionTest({
  mode,
  repoPath,
  issueText,
  selection
}: WriteRegressionTestArgs): Promise<RegressionTest> {
  if (mode === "offline") {
    return RegressionTestSchema.parse({
      file: "tests/cart.test.ts",
      testName: "returns 0 for an empty cart",
      newFileContent: OFFLINE_TEST_CONTENT,
      rationale: "The bug report says calculateTotal([]) should return 0, so the test locks that behavior."
    });
  }

  const selectedPaths = selection.relevantFiles.map((file) => file.path);
  const snippets = await readRepoSnippets(repoPath, selectedPaths);

  const regression = await generateStructured({
    taskName: "regression_test_writer",
    schema: RegressionTestSchema,
    instructions:
      "Create a regression test for the bug by rewriting one test file in full. Preserve existing useful tests. Return JSON shaped as { file, testName, newFileContent, rationale }.",
    input: {
      issueText,
      selectedFiles: selection.relevantFiles,
      snippets
    }
  });

  regression.file = assertSafeRelativePath(repoPath, regression.file);
  return regression;
}
