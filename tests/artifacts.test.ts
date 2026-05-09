import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RunTraceSchema } from "../src/schemas/runTrace.js";

const sampleLiveRunDir = path.resolve("docs/sample-live-run");
const secretPattern =
  /(sk-[A-Za-z0-9_-]{10,}|OPENAI_API_KEY\s*=\s*(?!your_key_here\b)[^\s]+|api[_-]?key\s*[:=]\s*["'][A-Za-z0-9_-]{10,}["'])/i;

describe("checked-in proof artifacts", () => {
  it("keeps the sanitized sample live trace schema-valid and visibly live", () => {
    const trace = RunTraceSchema.parse(
      JSON.parse(readFileSync(path.join(sampleLiveRunDir, "trace.json"), "utf8"))
    );

    expect(trace.mode).toBe("live");
    expect(trace.model).toBe("gpt-4.1-mini");
    expect(trace.finalStatus).toBe("passed");
    expect(trace.openaiCalls).toEqual([
      "file_selection",
      "regression_test_generation",
      "implementation_patch_generation"
    ]);
  });

  it("does not check secrets into sample live artifacts", () => {
    for (const file of readdirSync(sampleLiveRunDir)) {
      const content = readFileSync(path.join(sampleLiveRunDir, file), "utf8");
      expect(content, `${file} should not contain secret-looking material`).not.toMatch(secretPattern);
    }
  });
});
