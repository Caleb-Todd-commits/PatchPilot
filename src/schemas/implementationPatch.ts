import { z } from "zod";

export const ImplementationPatchSchema = z.object({
  file: z.string().min(1),
  strategy: z.literal("rewrite_file"),
  newFileContent: z.string().min(1),
  rationale: z.string().min(1)
});

export type ImplementationPatch = z.infer<typeof ImplementationPatchSchema>;
