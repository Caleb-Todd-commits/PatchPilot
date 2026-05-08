import { describe, expect, it } from "vitest";
import { FileSelectionSchema } from "../src/schemas/fileSelection.js";
import { ImplementationPatchSchema } from "../src/schemas/implementationPatch.js";
import { RegressionTestSchema } from "../src/schemas/regressionTest.js";

describe("structured model output schemas", () => {
  it("accepts the expected file selection shape", () => {
    expect(
      FileSelectionSchema.parse({
        relevantFiles: [
          {
            path: "src/cart.ts",
            role: "source",
            reason: "contains calculateTotal"
          }
        ]
      })
    ).toEqual({
      relevantFiles: [
        {
          path: "src/cart.ts",
          role: "source",
          reason: "contains calculateTotal"
        }
      ]
    });
  });

  it("rejects unsupported file roles and patch strategies", () => {
    expect(() =>
      FileSelectionSchema.parse({
        relevantFiles: [{ path: "README.md", role: "docs", reason: "not valid" }]
      })
    ).toThrow();

    expect(() =>
      ImplementationPatchSchema.parse({
        file: "src/cart.ts",
        strategy: "replace_snippet",
        newFileContent: "export {};",
        rationale: "not supported by the MVP"
      })
    ).toThrow();
  });

  it("accepts full-file regression test rewrites", () => {
    expect(
      RegressionTestSchema.parse({
        file: "tests/cart.test.ts",
        testName: "returns 0 for an empty cart",
        newFileContent: "it('returns 0', () => {});",
        rationale: "locks the reported behavior"
      }).testName
    ).toBe("returns 0 for an empty cart");
  });
});
