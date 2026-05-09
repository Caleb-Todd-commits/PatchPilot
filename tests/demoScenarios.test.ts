import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selectRelevantFiles } from "../src/agents/fileSelector.js";
import { planImplementationPatch } from "../src/agents/patchPlanner.js";
import { writeRegressionTest } from "../src/agents/regressionTestWriter.js";

describe("demo scenarios", () => {
  const repoPath = path.resolve("demo-repo");
  const taxDiscountIssue = readFileSync(
    path.join(repoPath, "issues", "tax-discount-order.md"),
    "utf8"
  );

  it("uses cross-module canned decisions for the tax-discount-order scenario", async () => {
    const selection = await selectRelevantFiles({
      mode: "offline",
      repoPath,
      issueText: taxDiscountIssue,
      files: [
        "src/cart.ts",
        "src/discounts.ts",
        "src/tax.ts",
        "tests/cart.test.ts"
      ]
    });

    expect(selection.relevantFiles.map((file) => file.path)).toEqual([
      "src/cart.ts",
      "src/discounts.ts",
      "src/tax.ts",
      "tests/cart.test.ts"
    ]);

    const regression = await writeRegressionTest({
      mode: "offline",
      repoPath,
      issueText: taxDiscountIssue,
      selection
    });

    expect(regression.testName).toBe("applies discount before tax and rounds the final total");
    expect(regression.newFileContent).toContain("37.87");

    const patch = await planImplementationPatch({
      mode: "offline",
      repoPath,
      issueText: taxDiscountIssue,
      selection,
      testOutput: "expected 38.28 to be 37.87"
    });

    expect(patch.newFileContent).toContain("const discountedSubtotal = applyFlatDiscount(subtotal, discount);");
    expect(patch.newFileContent).toContain("return roundCurrency(discountedSubtotal + tax);");
  });
});
