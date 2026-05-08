import { z } from "zod";

export const TraceStepSchema = z.object({
  name: z.string(),
  status: z.enum(["passed", "failed", "skipped"]),
  summary: z.string(),
  inputPreview: z.string().optional(),
  output: z.unknown().optional(),
  durationMs: z.number().optional()
});

export const RunTraceSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  mode: z.enum(["live", "offline"]),
  model: z.string().optional(),
  openaiCalls: z.array(z.string()),
  issuePath: z.string(),
  repoPath: z.string(),
  steps: z.array(TraceStepSchema),
  finalStatus: z.enum(["passed", "failed"])
});

export type TraceStep = z.infer<typeof TraceStepSchema>;
export type RunTrace = z.infer<typeof RunTraceSchema>;
