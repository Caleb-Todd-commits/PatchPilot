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
    expect(completed.steps).toHaveLength(1);
    expect(completed.steps[0]?.status).toBe("passed");
  });
});
