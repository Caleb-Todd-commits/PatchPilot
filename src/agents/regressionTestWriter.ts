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

const OFFLINE_TAX_DISCOUNT_TEST_CONTENT = `import { describe, expect, it } from "vitest";
import { calculateCheckoutTotal, calculateTotal } from "../src/cart";

describe("calculateTotal", () => {
  it("calculates totals for normal carts", () => {
    expect(
      calculateTotal([
        { price: 12, quantity: 2 },
        { price: 5, quantity: 3 }
      ])
    ).toBe(39);
  });

  it("applies discount before tax and rounds the final total", () => {
    expect(calculateCheckoutTotal([{ price: 19.99, quantity: 2 }], 5, 0.0825)).toBe(37.87);
  });
});
`;

function isTaxDiscountOrderIssue(issueText: string): boolean {
  return /tax/i.test(issueText) && /discount/i.test(issueText);
}

export async function writeRegressionTest({
  mode,
  repoPath,
  issueText,
  selection
}: WriteRegressionTestArgs): Promise<RegressionTest> {
  if (mode === "offline") {
    if (isTaxDiscountOrderIssue(issueText)) {
      return RegressionTestSchema.parse({
        file: "tests/cart.test.ts",
        testName: "applies discount before tax and rounds the final total",
        newFileContent: OFFLINE_TAX_DISCOUNT_TEST_CONTENT,
        rationale: "The bug report defines discount-before-tax ordering and a concrete expected total of 37.87."
      });
    }

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
    taskName: "regression_test_generation",
    schema: RegressionTestSchema,
    system:
      "You are PatchPilot's regression test generation agent. Return a full-file rewrite for one existing test file. Preserve existing imports and tests. Add only the minimum regression test needed. Assert the expected fixed behavior from the bug report, not the current broken behavior. The generated test must fail on the current implementation and pass after the intended fix. If the report says a value should be returned but the current behavior throws, assert the returned value; do not assert that it throws. Use only paths that exist in the selected files. Do not include markdown.",
    user: JSON.stringify(
      {
        instructions:
          "Create a failing regression test for the reported bug by rewriting one test file in full. The test should encode the Expected behavior from the bug report. Do not write a test that passes because it matches the Actual broken behavior. Return JSON shaped as { file, testName, newFileContent, rationale }.",
        expectedShape: isTaxDiscountOrderIssue(issueText)
          ? {
              file: "tests/cart.test.ts",
              testName: "applies discount before tax and rounds the final total",
              newFileContent: "full updated test file contents",
              rationale: "Adds a regression test for discount-before-tax ordering with the expected total 37.87."
            }
          : {
              file: "tests/cart.test.ts",
              testName: "returns 0 for an empty cart",
              newFileContent: "full updated test file contents",
              rationale: "Adds a regression test for the empty cart bug."
            },
        issueText,
        selectedFiles: selection.relevantFiles,
        snippets
      },
      null,
      2
    ),
    input: {
      issueText,
      selectedFiles: selection.relevantFiles,
      snippets
    }
  });

  regression.file = assertSafeRelativePath(repoPath, regression.file);
  return regression;
}
