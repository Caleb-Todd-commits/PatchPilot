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
    system:
      "You are PatchPilot's file selection agent. Select the source and test files most relevant to the bug report. Use only paths that exist in the file tree. Do not invent file paths.",
    user: JSON.stringify(
      {
        instructions:
          "Select the smallest useful set of files for a verified fix. Prefer one source file and one existing test file. Include config only if needed. Return JSON shaped as { relevantFiles: [{ path, role, reason }] }.",
        expectedShape: {
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

  for (const file of selection.relevantFiles) {
    file.path = assertSafeRelativePath(repoPath, file.path);
  }

  return selection;
}
