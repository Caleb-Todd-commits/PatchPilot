import OpenAI from "openai";
import type { z } from "zod";
import { getOpenAIModel } from "./config.js";

type GenerateStructuredArgs<T> = {
  taskName: string;
  instructions?: string;
  input?: unknown;
  system?: string;
  user?: string;
  schema: z.ZodType<T>;
};

function extractText(response: any): string {
  return (
    response.output_text ||
    response.output
      ?.flatMap((item: any) => item.content || [])
      ?.map((content: any) => content.text || "")
      ?.join("") ||
    ""
  );
}

function stringifyInput(input: unknown): string {
  return typeof input === "string" ? input : JSON.stringify(input, null, 2);
}

function parseAndValidate<T>(taskName: string, text: string, schema: z.ZodType<T>): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error(`${taskName} returned invalid JSON: ${text.slice(0, 500)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`${taskName} failed schema validation: ${JSON.stringify(result.error.format(), null, 2)}`);
  }

  return result.data;
}

export async function generateStructured<T>({
  taskName,
  instructions,
  input,
  system,
  user,
  schema
}: GenerateStructuredArgs<T>): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Live mode requires OPENAI_API_KEY. Run npm run demo:offline for the deterministic demo.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getOpenAIModel();
  const systemPrompt =
    system ??
    "You are PatchPilot, an AI verified-fix agent. Return ONLY valid JSON. Do not include markdown.";
  const userPrompt =
    user ??
    [
      `Task: ${taskName}`,
      instructions,
      "Input:",
      stringifyInput(input),
      "Return only JSON that exactly matches the requested shape."
    ]
      .filter(Boolean)
      .join("\n\n");
  let correctionPrompt = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response: any = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: `${systemPrompt}\nReturn ONLY valid JSON. Do not include markdown.`
        },
        {
          role: "user",
          content: correctionPrompt ? `${userPrompt}\n\n${correctionPrompt}` : userPrompt
        }
      ]
    });

    const text = extractText(response);
    try {
      return parseAndValidate(taskName, text, schema);
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      correctionPrompt = `Previous output failed. Fix this error and return corrected JSON only: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  throw new Error(`OpenAI output for ${taskName} did not validate.`);
}
