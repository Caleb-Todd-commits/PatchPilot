import type { PatchPilotMode } from "../config.js";
import type { RunTrace, TraceStep } from "../schemas/runTrace.js";
import { RunTraceSchema } from "../schemas/runTrace.js";

export class TraceRecorder {
  private readonly startedAt = new Date();
  private readonly steps: TraceStep[] = [];
  private readonly openaiCalls: string[] = [];
  private completedAt?: Date;
  private finalStatus: "passed" | "failed" = "failed";

  constructor(
    private readonly runId: string,
    private readonly mode: PatchPilotMode,
    private readonly issuePath: string,
    private readonly repoPath: string,
    private readonly model?: string
  ) {}

  addStep(step: TraceStep): void {
    this.steps.push(step);
  }

  recordOpenAICall(taskName: string): void {
    if (!this.openaiCalls.includes(taskName)) {
      this.openaiCalls.push(taskName);
    }
  }

  async measure<T>(
    name: string,
    inputPreview: string | undefined,
    action: () => Promise<{ summary: string; output?: unknown; value: T }>
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await action();
      this.addStep({
        name,
        status: "passed",
        summary: result.summary,
        inputPreview,
        output: result.output,
        durationMs: Date.now() - startedAt
      });
      return result.value;
    } catch (error) {
      this.addStep({
        name,
        status: "failed",
        summary: error instanceof Error ? error.message : String(error),
        inputPreview,
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  complete(finalStatus: "passed" | "failed"): RunTrace {
    this.completedAt = new Date();
    this.finalStatus = finalStatus;
    return this.snapshot();
  }

  snapshot(): RunTrace {
    const trace = {
      runId: this.runId,
      startedAt: this.startedAt.toISOString(),
      completedAt: (this.completedAt ?? new Date()).toISOString(),
      mode: this.mode,
      model: this.model,
      openaiCalls: this.openaiCalls,
      issuePath: this.issuePath,
      repoPath: this.repoPath,
      steps: this.steps,
      finalStatus: this.finalStatus
    };

    return RunTraceSchema.parse(trace);
  }
}
