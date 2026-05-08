import { describe, expect, it } from "vitest";
import { RunTraceSchema } from "../src/schemas/runTrace.js";
import { TraceRecorder } from "../src/tools/trace.js";

describe("run trace", () => {
  it("records a schema-valid completed run", () => {
    const trace = new TraceRecorder("run-test", "offline", "issues/empty-cart.md", "/tmp/repo");

    trace.addStep({
      name: "load_bug_report",
      status: "passed",
      summary: "Loaded bug report markdown."
    });

    const completed = trace.complete("passed");

    expect(RunTraceSchema.parse(completed).finalStatus).toBe("passed");
    expect(completed.openaiCalls).toEqual([]);
    expect(completed.steps).toHaveLength(1);
    expect(completed.steps[0]?.status).toBe("passed");
  });

  it("records OpenAI calls and model metadata for live runs", () => {
    const trace = new TraceRecorder(
      "run-live-test",
      "live",
      "issues/empty-cart.md",
      "/tmp/repo",
      "gpt-4.1-mini"
    );

    trace.recordOpenAICall("file_selection");
    trace.recordOpenAICall("regression_test_generation");
    trace.recordOpenAICall("implementation_patch_generation");

    const completed = RunTraceSchema.parse(trace.complete("passed"));

    expect(completed.mode).toBe("live");
    expect(completed.model).toBe("gpt-4.1-mini");
    expect(completed.openaiCalls).toEqual([
      "file_selection",
      "regression_test_generation",
      "implementation_patch_generation"
    ]);
  });
});
