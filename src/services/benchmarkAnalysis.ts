export type BenchmarkType = "feature" | "performance" | "price" | "user_experience" | "sustainability" | "market_position";

export type BenchmarkRow = {
  criterion: string;
  current: string;
  competitors: { name: string; value: string }[];
  gap: string;
  opportunity: string;
  importance: number;
  metric: { name: string; direction: "up" | "down" | "target"; target: string };
};

export type BenchmarkAnalysis = {
  competitors: string[];
  summary: string;
  rows: BenchmarkRow[];
  references: { title: string; url: string; relevance: string }[];
  source: "llm" | "local-draft";
};

const endpoint = import.meta.env.VITE_LLM_BENCHMARK_ENDPOINT || "/api/benchmark-analysis";

export async function generateBenchmarkAnalysis(title: string, idea: string, types: BenchmarkType[]): Promise<BenchmarkAnalysis> {
  if (!import.meta.env.VITE_LLM_BENCHMARK_ENDPOINT) {
    return generatePuterBenchmark(title, idea, types);
  }

  const body = JSON.stringify({ title, idea, benchmarkTypes: types });
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!response.ok) throw new Error(`Benchmark provider returned HTTP ${response.status}.`);
    const result = await response.json() as Omit<BenchmarkAnalysis, "source">;
    if (!Array.isArray(result.competitors) || !Array.isArray(result.rows)) throw new Error("Benchmark provider returned an invalid structured response.");
    return { ...result, references: Array.isArray(result.references) ? result.references : [], source: "llm" };
  } catch (error) {
    throw error instanceof Error ? error : new Error("The benchmark provider failed.");
  }
}

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

async function generatePuterBenchmark(title: string, idea: string, types: BenchmarkType[]): Promise<BenchmarkAnalysis> {
  const prompt = `You are a skeptical product benchmarking researcher inside IdeaView. Return ONLY valid JSON matching this schema:
{"competitors":["2 to 4 named competitors"],"summary":"string","rows":[{"criterion":"string","current":"current product assessment","competitors":[{"name":"competitor name","value":"comparable value or unknown"}],"gap":"evidence-based gap or unknown","opportunity":"actionable opportunity","importance":1,"metric":{"name":"measurable engineering metric","direction":"up|down|target","target":"target or measurement plan"}}],"references":[{"title":"source title","url":"https://...","relevance":"claim or comparison this source can verify"}]}
Benchmark only these dimensions: ${types.join(", ")}. Do not invent verified facts, prices, or specifications. Label estimates as hypotheses and use unknown where needed. Make each row useful for House of Quality.
Return 3 to 8 credible references when relevant. Prefer official competitor pages, technical documentation, standards, government data, or research. Do not invent URLs; return an empty array if no reliable source is available.
Project title: ${title}
Current product and competitor instruction: ${idea}`;

  try {
    const response = await puter.ai.chat(prompt, { model: "gemini-3.8-flash" });
    const content = response.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Puter returned an empty benchmark.");
    }
    const result = JSON.parse(cleanJsonResponse(content)) as Omit<BenchmarkAnalysis, "source">;
    if (!Array.isArray(result.competitors) || result.competitors.length < 1 || !Array.isArray(result.rows) || result.rows.length < 1) {
      throw new Error("Puter returned an incomplete structured benchmark.");
    }
    return { ...result, references: Array.isArray(result.references) ? result.references : [], source: "llm" };
  } catch (error) {
    throw new Error(error instanceof Error ? `The benchmark could not be generated with Puter. ${error.message}` : "The benchmark could not be generated with Puter.");
  }
}
import { puter } from "@heyputer/puter.js";
