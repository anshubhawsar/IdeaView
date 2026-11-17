import { puter } from "@heyputer/puter.js";

export type GeneratedAnalysis = {
  features: string[];
  metrics: { name: string; direction: "up" | "down" | "target"; target: string }[];
  summary: string;
  problem: string;
  assumptions: string[];
  tests: string[];
  references: { title: string; url: string; relevance: string }[];
  source: "llm" | "local-draft";
};

type LlmResponse = Omit<GeneratedAnalysis, "source">;

function cleanJsonResponse(content: string): string {
  const fenced = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  let result = "";
  let inString = false;
  let escaped = false;
  for (const character of candidate) {
    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      result += character;
      if (inString) escaped = true;
      continue;
    }
    if (character === "\"") {
      inString = !inString;
      result += character;
      continue;
    }
    if (inString && character.charCodeAt(0) < 32) {
      result += character === "\n" ? "\\n" : character === "\r" ? "\\r" : character === "\t" ? "\\t" : `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
    } else {
      result += character;
    }
  }
  return result;
}

export async function generateIdeaAnalysis(title: string, idea: string): Promise<GeneratedAnalysis> {
  const prompt = `You are a skeptical senior product-development researcher.
Analyze this idea as a comprehensive product-development report and return ONLY valid JSON matching this schema:
{
  "summary": "detailed opportunity summary with trade-offs and uncertainty",
  "problem": "detailed customer problem to investigate",
  "features": ["exactly 10 distinct, testable candidate customer needs or product features"],
  "metrics": [{"name": "exactly 10 measurable engineering metrics", "direction": "up|down|target", "target": "specific proposed target or measurement plan"}],
  "assumptions": ["exactly 8 assumptions that could invalidate the idea"],
  "tests": ["exactly 8 prioritized tests grounded in past behavior or observation"],
  "references": [{"title": "source title", "url": "https://...", "relevance": "claim or decision this source can verify"}]
}
Do not return fewer than the requested item counts. Make every item materially different and specific to the idea.
Return 3 to 8 credible references when relevant. Prefer official standards, manufacturer documentation, peer-reviewed research, government data, or clearly identified industry sources. Do not invent URLs; if no source is available, return an empty array.
Do not invent customer evidence. Label uncertain claims as hypotheses. Make features useful as House of Quality customer-need rows and metrics useful as engineering-metric columns.
Project title: ${title}
Idea brief: ${idea}`;
  try {
    const response = await puter.ai.chat(prompt, { model: "gemini-3.8-flash" });
    const content = response.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Puter returned an empty analysis.");
    }
    const cleaned = cleanJsonResponse(content);
    const result = JSON.parse(cleaned) as LlmResponse;
    if (!Array.isArray(result.features) || result.features.length < 10 || !Array.isArray(result.metrics) || result.metrics.length < 10 || !Array.isArray(result.assumptions) || result.assumptions.length < 8 || !Array.isArray(result.tests) || result.tests.length < 8 || !Array.isArray(result.references)) {
      throw new Error("Puter returned an incomplete structured report.");
    }
    return { ...result, source: "llm" };
  } catch (error) {
    throw new Error(error instanceof Error ? `The detailed report could not be generated with Puter. ${error.message}` : "The detailed report could not be generated with Puter.");
  }
}

export function createLocalDraft(idea: string): GeneratedAnalysis {
  return {
    source: "local-draft",
    summary: `A structured opportunity draft based only on the submitted brief: “${idea}”`,
    problem: "The brief suggests a recurring customer situation where the current experience is difficult, unreliable, or underserved. Validate the specific user, context, frequency, and existing workaround before treating this as evidence.",
    features: ["Reliable core outcome in the stated use context", "Simple interaction with clear feedback", "Easy to clean, maintain, or reset", "Visible signal that the product is working", "Portable form suited to the user’s routine", "Safe operation across the intended environment", "Durable construction for repeated daily use", "Accessible interaction for the target user", "Efficient setup, storage, or charging workflow", "Serviceable design with replaceable or maintainable parts"],
    metrics: [
      { name: "Outcome reliability", direction: "up", target: "Define with observed baseline" },
      { name: "Time to complete primary task", direction: "down", target: "Measure current workflow first" },
      { name: "User effort / force", direction: "target", target: "Set from user test data" },
      { name: "Failure rate in intended context", direction: "down", target: "Set acceptance threshold" },
      { name: "Cleaning / reset time", direction: "down", target: "Measure current workaround" },
      { name: "Operating temperature range", direction: "target", target: "Define from intended environment" },
      { name: "Durability over repeated cycles", direction: "up", target: "Test against daily-use cycle count" },
      { name: "Setup / reset steps", direction: "down", target: "Count steps in observed workflow" },
      { name: "Manufacturing or delivered cost", direction: "down", target: "Set after costed prototype" },
      { name: "User-reported confidence", direction: "up", target: "Measure with a defined post-use scale" },
    ],
    assumptions: ["The described problem occurs often enough to matter.", "The intended user is willing to change their current workaround.", "The proposed outcome can be delivered within practical cost and technical constraints.", "The target environment is stable enough for the proposed solution to work.", "Users will understand the product’s feedback without extensive training.", "The primary failure mode can be detected before it causes harm or frustration.", "The product can be cleaned, serviced, or reset at an acceptable effort.", "The value created is large enough to justify the expected price or adoption effort."],
    tests: ["Interview users about the last time this happened; avoid hypothetical questions.", "Observe the current workaround in context and record time, effort, and failure points.", "Prototype the riskiest interaction and measure completion against a defined criterion.", "Run a task-based usability test with representative users and record errors and recovery.", "Test the main physical or technical failure mode under realistic boundary conditions.", "Create a rough costed prototype and compare its value with the current workaround.", "Run a repeated-use or accelerated durability test against the expected usage cycle.", "Show alternative concepts to target users and measure preference plus reasons using a consistent protocol."],
    references: [],
  };
}
