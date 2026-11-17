export const objectTypes = [
  "NOTE",
  "QUOTE",
  "NEED_STATEMENT",
  "ASSUMPTION",
] as const;

export type WorkObjectType = (typeof objectTypes)[number];
export type EvidenceGrade =
  | "OPINION"
  | "STATED_FACT"
  | "OBSERVED_BEHAVIOR"
  | "COMMITMENT";

export type CanvasPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
};

export type WorkObject = {
  id: string;
  projectId: string;
  type: WorkObjectType;
  title: string;
  body: string;
  levelOfDetail: "Opportunity" | "Concept" | "Subsystem" | "Part" | "Tolerance";
  evidenceGrade: EvidenceGrade;
  status: "DRAFT" | "IN_REVIEW" | "VALIDATED" | "REJECTED";
  aiGenerated: boolean;
  canvasPosition: CanvasPosition;
  createdAt: string;
  updatedAt: string;
};

export type LinkType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DERIVED_FROM"
  | "ADDRESSES"
  | "IMPLEMENTS"
  | "VERIFIES"
  | "DEPENDS_ON";

export type WorkLink = {
  id: string;
  projectId: string;
  fromObjectId: string;
  toObjectId: string;
  type: LinkType;
  rationale: string;
  createdAt: string;
};

export type ProjectEvent = {
  id: string;
  projectId: string;
  opType: string;
  payload: string;
  timestamp: string;
};

export const typeLabels: Record<WorkObjectType, string> = {
  NOTE: "Note",
  QUOTE: "Quote",
  NEED_STATEMENT: "Need statement",
  ASSUMPTION: "Assumption",
};

export function createWorkObject(
  projectId: string,
  type: WorkObjectType,
  index: number,
): WorkObject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectId,
    type,
    title: typeLabels[type],
    body: "",
    levelOfDetail: "Opportunity",
    evidenceGrade: "OPINION",
    status: "DRAFT",
    aiGenerated: false,
    canvasPosition: {
      x: 90 + (index % 4) * 260,
      y: 80 + Math.floor(index / 4) * 190,
      w: 220,
      h: 150,
      rotation: 0,
      z: index + 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}
