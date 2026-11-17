import { describe, expect, it } from "vitest";
import { classifyKano, opportunityScore, relativeImportance, technicalImportance } from "./analysisModels";

describe("analysis models", () => {
  it("calculates House of Quality importance", () => {
    const needs = [{ id: "n1", need: "Safe", importance: 5, relationships: [9, 1] }];
    expect(technicalImportance(needs, 0)).toBe(45);
    expect(relativeImportance(needs, 0)).toBeCloseTo(100);
  });
  it("classifies standard Kano responses", () => {
    expect(classifyKano("like", "dislike")).toBe("Must-be");
    expect(classifyKano("dislike", "like")).toBe("Reverse");
  });
  it("calculates opportunity score", () => {
    expect(opportunityScore(9, 3)).toBe(15);
  });
});
