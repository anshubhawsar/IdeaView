export type KanoAnswer = "like" | "expect" | "neutral" | "live_with" | "dislike";

export type HoQNeed = {
  id: string;
  need: string;
  importance: number;
  relationships: number[];
};

export type HoQMetric = {
  id: string;
  name: string;
  direction: "up" | "down" | "target";
  target: string;
};

export function technicalImportance(needs: HoQNeed[], metricIndex: number) {
  return needs.reduce((sum, need) => sum + need.importance * (need.relationships[metricIndex] ?? 0), 0);
}

export function relativeImportance(needs: HoQNeed[], metricIndex: number) {
  const total = needs.reduce((sum, _, index) => sum + technicalImportance(needs, index), 0);
  return total === 0 ? 0 : (technicalImportance(needs, metricIndex) / total) * 100;
}

const kanoTable: Record<KanoAnswer, Record<KanoAnswer, string>> = {
  like: { like: "Questionable", expect: "Performance", neutral: "Performance", live_with: "Performance", dislike: "Must-be" },
  expect: { like: "Reverse", expect: "Indifferent", neutral: "Indifferent", live_with: "Indifferent", dislike: "Must-be" },
  neutral: { like: "Reverse", expect: "Indifferent", neutral: "Indifferent", live_with: "Indifferent", dislike: "Must-be" },
  live_with: { like: "Reverse", expect: "Indifferent", neutral: "Indifferent", live_with: "Indifferent", dislike: "Must-be" },
  dislike: { like: "Reverse", expect: "Reverse", neutral: "Reverse", live_with: "Reverse", dislike: "Questionable" },
};

export function classifyKano(functional: KanoAnswer, dysfunctional: KanoAnswer) {
  return kanoTable[functional][dysfunctional];
}

export function opportunityScore(importance: number, satisfaction: number) {
  return importance + Math.max(importance - satisfaction, 0);
}
