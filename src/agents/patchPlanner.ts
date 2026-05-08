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

const OFFLINE_PATCH_CONTENT = `export type CartItem = { price: number; quantity: number };

export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
`;

export async function planImplementationPatch({
  mode,
  repoPath,
  issueText,
  selection,
  testOutput
}: PlanImplementationPatchArgs): Promise<ImplementationPatch> {
  if (mode === "offline") {
    return ImplementationPatchSchema.parse({
      file: "src/cart.ts",
      strategy: "rewrite_file",
      newFileContent: OFFLINE_PATCH_CONTENT,
      rationale: "Providing an initial value of 0 makes reduce safe for empty carts and preserves normal totals."
    });
  }

  const sourceFiles = selection.relevantFiles
    .filter((file) => file.role === "source")
    .map((file) => file.path);
  const snippets = await readRepoSnippets(repoPath, sourceFiles);

  const patch = await generateStructured({
    taskName: "implementation_patch",
    schema: ImplementationPatchSchema,
    instructions:
      "Fix the bug with the smallest implementation change by rewriting one source file in full. Return JSON shaped as { file, strategy: 'rewrite_file', newFileContent, rationale }.",
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
