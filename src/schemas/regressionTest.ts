import { z } from "zod";

export const RegressionTestSchema = z.object({
  file: z.string().min(1),
  testName: z.string().min(1),
  newFileContent: z.string().min(1),
  rationale: z.string().min(1)
});

export type RegressionTest = z.infer<typeof RegressionTestSchema>;
