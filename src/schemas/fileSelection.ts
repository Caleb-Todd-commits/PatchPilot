import { z } from "zod";

export const FileSelectionSchema = z.object({
  relevantFiles: z
    .array(
      z.object({
        path: z.string().min(1),
        role: z.enum(["source", "test", "config"]),
        reason: z.string().min(1)
      })
    )
    .min(1)
});

export type FileSelection = z.infer<typeof FileSelectionSchema>;
