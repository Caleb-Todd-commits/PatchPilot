import type { PatchPilotMode } from "../config.js";
import type { FileSelection } from "../schemas/fileSelection.js";
import { ImplementationPatchSchema, type ImplementationPatch } from "../schemas/implementationPatch.js";
import { readRepoSnippets } from "../tools/fsTools.js";
import { assertSafeRelativePath } from "../tools/safety.js";
import { generateStructured } from "../openaiClient.js";

type PlanImplementationPatchArgs = {
  mode: PatchPilotMode;
  repoPath: string;
  issueText: string;
  selection: FileSelection;
  testOutput: string;
};

const OFFLINE_PATCH_CONTENT = `import { applyFlatDiscount } from "./discounts";
import { calculateTax, roundCurrency } from "./tax";

export type CartItem = { price: number; quantity: number };

export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calculateCheckoutTotal(items: CartItem[], discount: number, taxRate: number): number {
  const subtotal = calculateTotal(items);
  const taxedSubtotal = subtotal + calculateTax(subtotal, taxRate);
  return roundCurrency(applyFlatDiscount(taxedSubtotal, discount));
}
`;

const OFFLINE_TAX_DISCOUNT_PATCH_CONTENT = `import { applyFlatDiscount } from "./discounts";
import { calculateTax, roundCurrency } from "./tax";

export type CartItem = { price: number; quantity: number };

export function calculateTotal(items: CartItem[]): number {
  const [first, ...rest] = items;
  return rest.reduce((sum, item) => sum + item.price * item.quantity, first!.price * first!.quantity);
}

export function calculateCheckoutTotal(items: CartItem[], discount: number, taxRate: number): number {
  const subtotal = calculateTotal(items);
  const discountedSubtotal = applyFlatDiscount(subtotal, discount);
  const tax = calculateTax(discountedSubtotal, taxRate);
  return roundCurrency(discountedSubtotal + tax);
}
`;

function isTaxDiscountOrderIssue(issueText: string): boolean {
  return /tax/i.test(issueText) && /discount/i.test(issueText);
}

export async function planImplementationPatch({
  mode,
  repoPath,
  issueText,
  selection,
  testOutput
}: PlanImplementationPatchArgs): Promise<ImplementationPatch> {
  if (mode === "offline") {
    if (isTaxDiscountOrderIssue(issueText)) {
      return ImplementationPatchSchema.parse({
        file: "src/cart.ts",
        strategy: "rewrite_file",
        newFileContent: OFFLINE_TAX_DISCOUNT_PATCH_CONTENT,
        rationale: "Applies the flat discount to the subtotal first, clamps it through applyFlatDiscount, then calculates tax and rounds the final total."
      });
    }

    return ImplementationPatchSchema.parse({
      file: "src/cart.ts",
      strategy: "rewrite_file",
      newFileContent: OFFLINE_PATCH_CONTENT,
      rationale: "Providing an initial value of 0 makes reduce safe for empty carts and preserves normal totals."
    });
  }

  const sourceFiles = selection.relevantFiles
    .filter((file) => file.role === "source" || file.role === "test" || file.role === "config")
    .map((file) => file.path);
  const snippets = await readRepoSnippets(repoPath, sourceFiles);

  const patch = await generateStructured({
    taskName: "implementation_patch_generation",
    schema: ImplementationPatchSchema,
    system:
      "You are PatchPilot's implementation patch agent. Fix the bug with the smallest source change. Return a full-file rewrite for one existing source file. Preserve public API and unrelated behavior. Do not include markdown.",
    user: JSON.stringify(
      {
        instructions:
          "Generate the implementation fix. Return JSON shaped as { file, strategy: 'rewrite_file', newFileContent, rationale }. The strategy must be exactly 'rewrite_file'.",
        expectedShape: isTaxDiscountOrderIssue(issueText)
          ? {
              file: "src/cart.ts",
              strategy: "rewrite_file",
              newFileContent: "full updated source file contents",
              rationale: "Applies discount to subtotal first, clamps it, applies tax, and rounds the final total."
            }
          : {
              file: "src/cart.ts",
              strategy: "rewrite_file",
              newFileContent: "full updated source file contents",
              rationale: "Adds an initial accumulator value so empty carts return 0."
            },
        issueText,
        selectedFiles: selection.relevantFiles,
        failingTestOutput: testOutput.slice(0, 8000),
        snippets
      },
      null,
      2
    ),
    input: {
      issueText,
      selectedFiles: selection.relevantFiles,
      failingTestOutput: testOutput.slice(0, 8000),
      snippets
    }
  });

  patch.file = assertSafeRelativePath(repoPath, patch.file);
  return patch;
}
