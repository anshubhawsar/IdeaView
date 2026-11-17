import { describe, expect, it } from "vitest";
import { createWorkObject } from "./workObjects";

describe("work object foundation", () => {
  it("creates a draft object with a stable canvas position", () => {
    const object = createWorkObject("project-1", "NEED_STATEMENT", 5);
    expect(object.projectId).toBe("project-1");
    expect(object.status).toBe("DRAFT");
    expect(object.evidenceGrade).toBe("OPINION");
    expect(object.canvasPosition.x).toBe(350);
    expect(object.canvasPosition.y).toBe(270);
  });
});
