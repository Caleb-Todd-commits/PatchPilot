import OpenAI from "openai";
import type { z } from "zod";
import { getOpenAIModel } from "./config.js";

type GenerateStructuredArgs<T> = {
  taskName: string;
  instructions: string;
  input: unknown;
  schema: z.ZodType<T>;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

function stringifyInput(input: unknown): string {
  return typeof input === "string" ? input : JSON.stringify(input, null, 2);
}

export async function generateStructured<T>({
  taskName,
  instructions,
  input,
  schema
}: GenerateStructuredArgs<T>): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for live mode.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getOpenAIModel();
  let validationHint = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response: any = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are PatchPilot, an AI verified-fix agent. Return strict JSON only. Do not include Markdown fences unless explicitly asked."
        },
        {
          role: "user",
          content: [
            `Task: ${taskName}`,
            instructions,
            validationHint,
            "Input:",
            stringifyInput(input),
            "Return only JSON that matches the requested shape."
          ]
            .filter(Boolean)
            .join("\n\n")
        }
      ]
    });

    const text = response.output_text ?? "";
    try {
      return schema.parse(extractJson(text));
    } catch (error) {
      if (attempt === 2) {
        throw new Error(
          `OpenAI output for ${taskName} did not validate: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      validationHint = `Previous output failed validation. Fix this validation error and return JSON only: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  throw new Error(`OpenAI output for ${taskName} did not validate.`);
}
