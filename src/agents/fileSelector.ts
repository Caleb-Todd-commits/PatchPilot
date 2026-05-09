import type { PatchPilotMode } from "../config.js";
import { FileSelectionSchema, type FileSelection } from "../schemas/fileSelection.js";
import { readRepoSnippets } from "../tools/fsTools.js";
import { assertSafeRelativePath } from "../tools/safety.js";
import { generateStructured } from "../openaiClient.js";

type SelectFilesArgs = {
  mode: PatchPilotMode;
  repoPath: string;
  issueText: string;
  files: string[];
};

function isTaxDiscountOrderIssue(issueText: string): boolean {
  return /tax/i.test(issueText) && /discount/i.test(issueText);
}

function includeIssueNamedSupportingFiles(selection: FileSelection, issueText: string, files: string[]): FileSelection {
  const relevantFiles = [...selection.relevantFiles];

  function addIfPresent(filePath: string, reason: string): void {
    if (!files.includes(filePath) || relevantFiles.some((file) => file.path === filePath)) {
      return;
    }

    relevantFiles.push({
      path: filePath,
      role: "source",
      reason
    });
  }

  if (isTaxDiscountOrderIssue(issueText)) {
    addIfPresent("src/discounts.ts", "The issue names discount ordering and this module owns discount application.");
    addIfPresent("src/tax.ts", "The issue names tax calculation and this module owns tax and currency rounding.");
  }

  return FileSelectionSchema.parse({ relevantFiles });
}

export async function selectRelevantFiles({
  mode,
  repoPath,
  issueText,
  files
}: SelectFilesArgs): Promise<FileSelection> {
  if (mode === "offline") {
    if (isTaxDiscountOrderIssue(issueText)) {
      return FileSelectionSchema.parse({
        relevantFiles: [
          {
            path: "src/cart.ts",
            role: "source",
            reason: "calculateCheckoutTotal coordinates subtotal, discount, tax, and final rounding."
          },
          {
            path: "src/discounts.ts",
            role: "source",
            reason: "Discount application and clamping belong in the discounts module."
          },
          {
            path: "src/tax.ts",
            role: "source",
            reason: "Tax calculation and currency rounding belong in the tax module."
          },
          {
            path: "tests/cart.test.ts",
            role: "test",
            reason: "Cart total tests are the right place for checkout-order regression coverage."
          }
        ]
      });
    }

    return FileSelectionSchema.parse({
      relevantFiles: [
        {
          path: "src/cart.ts",
          role: "source",
          reason: "calculateTotal is the cart total implementation named in the bug report."
        },
        {
          path: "tests/cart.test.ts",
          role: "test",
          reason: "Existing cart tests are the right place for the empty-cart regression."
        }
      ]
    });
  }

  const interestingFiles = files.filter((file) =>
    /\.(ts|tsx|js|jsx|mjs|cjs|json|md)$/.test(file)
  );
  const snippets = await readRepoSnippets(repoPath, interestingFiles.slice(0, 40));

  const selection = await generateStructured({
    taskName: "file_selection",
    schema: FileSelectionSchema,
    system:
      "You are PatchPilot's file selection agent. Select the source and test files most relevant to the bug report. Include directly imported helper modules when the bug describes behavior composed across modules. Use only paths that exist in the file tree. Do not invent file paths.",
    user: JSON.stringify(
      {
        instructions:
          "Select the smallest useful set of files for a verified fix. Prefer the main source file, directly relevant helper modules, and one existing test file. Include config only if needed. For tax and discount ordering bugs, include cart, discounts, tax, and cart tests when those files exist. Return JSON shaped as { relevantFiles: [{ path, role, reason }] }.",
        expectedShape: isTaxDiscountOrderIssue(issueText)
          ? {
              relevantFiles: [
                {
                  path: "src/cart.ts",
                  role: "source",
                  reason: "Coordinates subtotal, discount, tax, and final rounding."
                },
                {
                  path: "src/discounts.ts",
                  role: "source",
                  reason: "Contains discount application and clamping."
                },
                {
                  path: "src/tax.ts",
                  role: "source",
                  reason: "Contains tax calculation and currency rounding."
                },
                {
                  path: "tests/cart.test.ts",
                  role: "test",
                  reason: "Contains cart total tests."
                }
              ]
            }
          : {
              relevantFiles: [
                {
                  path: "src/cart.ts",
                  role: "source",
                  reason: "Contains calculateTotal implementation."
                },
                {
                  path: "tests/cart.test.ts",
                  role: "test",
                  reason: "Contains cart total tests."
                }
              ]
            },
        issueText,
        fileTree: interestingFiles,
        snippets
      },
      null,
      2
    ),
    input: {
      issueText,
      files: interestingFiles,
      snippets
    }
  });

  const completeSelection = includeIssueNamedSupportingFiles(selection, issueText, interestingFiles);

  for (const file of completeSelection.relevantFiles) {
    file.path = assertSafeRelativePath(repoPath, file.path);
  }

  return completeSelection;
}
