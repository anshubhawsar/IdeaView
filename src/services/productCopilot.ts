export type CopilotContext = {
  projectTitle: string;
  currentIdea: string;
  canvas: {
    objects: { type: string; title: string; body: string; evidenceGrade: string }[];
    links: { fromObjectId: string; toObjectId: string; type: string; rationale: string }[];
  };
  houseOfQuality: {
    needs: { need: string; importance: number; relationships: number[] }[];
    metrics: { name: string; direction: string; target: string }[];
  };
  kano: {
    features: { feature: string; functional: string; dysfunctional: string; classification: string; importance: number; satisfaction: number }[];
  };
  mainReport: {
    summary: string;
    problem: string;
    features: string[];
    metrics: { name: string; direction: string; target: string }[];
    assumptions: string[];
    tests: string[];
    references: { title: string; url: string; relevance: string }[];
  } | null;
};

export async function askProductCopilot(question: string, context: CopilotContext): Promise<string> {
  const prompt = `You are Product Copilot inside IdeaView. Answer the user's question directly and only use relevant information from the supplied workspace context.
Start with a one-sentence direct answer. Do not discuss unrelated objects, conflicting concepts, or other workspace areas unless they are necessary to answer the question.
Use this response format:
### Direct answer
One or two sentences answering exactly what was asked.
### Evidence
2 to 4 concise bullets from the context. Label each as Fact, Hypothesis, or Gap.
### Recommendation
One concrete next step only, when useful.
Do not produce a broad report, repeat the entire context, or invent customer evidence, competitor facts, measurements, or model values.
If the answer is not established, say "Not established yet" and name the smallest missing decision or test.
Keep the response under 180 words. Use clean Markdown and short bullets.

USER QUESTION:
${question}

OPTIMIZED WORKSPACE CONTEXT:
${JSON.stringify(context)}`;
  const response = await puter.ai.chat(prompt, { model: "gemini-3.8-flash" });
  const content = response.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Puter returned an empty Product Copilot response.");
  }
  return content.trim();
}
import { puter } from "@heyputer/puter.js";
