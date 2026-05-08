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

export async function selectRelevantFiles({
  mode,
  repoPath,
  issueText,
  files
}: SelectFilesArgs): Promise<FileSelection> {
  if (mode === "offline") {
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
    instructions:
      "Select the smallest set of source, test, and config files likely needed to reproduce and fix the bug. Return JSON shaped as { relevantFiles: [{ path, role, reason }] }.",
    input: {
      issueText,
      files: interestingFiles,
      snippets
    }
  });

  for (const file of selection.relevantFiles) {
    file.path = assertSafeRelativePath(repoPath, file.path);
  }

  return selection;
}
