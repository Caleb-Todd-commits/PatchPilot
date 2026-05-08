import { createTwoFilesPatch } from "diff";

export function createFileRewriteDiff(filePath: string, before: string, after: string): string {
  return createTwoFilesPatch(`a/${filePath}`, `b/${filePath}`, before, after, "", "", {
    context: 3
  });
}
