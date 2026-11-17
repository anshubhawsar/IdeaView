import { create } from "zustand";
import {
  createWorkObject,
  type EvidenceGrade,
  type LinkType,
  type ProjectEvent,
  type WorkLink,
  type WorkObject,
  type WorkObjectType,
} from "../domain/workObjects";

const projectId = "demo-project";
const storageKey = "praxis-m1-workspace";

type Snapshot = {
  objects: WorkObject[];
  links: WorkLink[];
  events: ProjectEvent[];
};

type WorkspaceState = Snapshot & {
  selectedObjectId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  addObject: (type: WorkObjectType) => string;
  updateObject: (id: string, patch: Partial<WorkObject>) => void;
  addLink: (
    fromObjectId: string,
    toObjectId: string,
    type: LinkType,
    rationale: string,
  ) => void;
  selectObject: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
};

const demoObjects: WorkObject[] = [
  {
    ...createWorkObject(projectId, "NOTE", 0),
    title: "Shift worker lunch routine",
    body: "Capture what people do today before proposing a solution.",
    evidenceGrade: "STATED_FACT",
  },
  {
    ...createWorkObject(projectId, "NEED_STATEMENT", 1),
    title: "Keep food at a safe temperature",
    body: "A shift worker needs confidence that their meal stays safe during a long shift.",
    evidenceGrade: "OBSERVED_BEHAVIOR",
  },
  {
    ...createWorkObject(projectId, "ASSUMPTION", 2),
    title: "Seal survives repeated opening",
    body: "The lid seal remains reliable after daily cleaning and opening.",
  },
];

const initialSnapshot: Snapshot = {
  objects: demoObjects,
  links: [],
  events: [],
};

function readSnapshot(): Snapshot {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as Snapshot) : initialSnapshot;
  } catch {
    return initialSnapshot;
  }
}

function persist(snapshot: Snapshot) {
  localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function eventFor(opType: string, payload: unknown): ProjectEvent {
  return {
    id: crypto.randomUUID(),
    projectId,
    opType,
    payload: JSON.stringify(payload),
    timestamp: new Date().toISOString(),
  };
}

const snapshot = readSnapshot();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...snapshot,
  selectedObjectId: null,
  past: [],
  future: [],
  addObject: (type) => {
    const current = get();
    const object = createWorkObject(projectId, type, current.objects.length);
    const next = {
      objects: [...current.objects, object],
      links: current.links,
      events: [...current.events, eventFor("WORK_OBJECT_CREATED", { objectId: object.id, type })],
    };
    persist(next);
    set({ ...next, past: [...current.past, current], future: [], selectedObjectId: object.id });
    return object.id;
  },
  updateObject: (id, patch) => {
    const current = get();
    const objects = current.objects.map((object) =>
      object.id === id ? { ...object, ...patch, updatedAt: new Date().toISOString() } : object,
    );
    const next = {
      objects,
      links: current.links,
      events: [...current.events, eventFor("WORK_OBJECT_UPDATED", { objectId: id, patch })],
    };
    persist(next);
    set({ ...next, past: [...current.past, { objects: current.objects, links: current.links, events: current.events }], future: [] });
  },
  addLink: (fromObjectId, toObjectId, type, rationale) => {
    const current = get();
    const link: WorkLink = {
      id: crypto.randomUUID(),
      projectId,
      fromObjectId,
      toObjectId,
      type,
      rationale,
      createdAt: new Date().toISOString(),
    };
    const next = {
      objects: current.objects,
      links: [...current.links, link],
      events: [...current.events, eventFor("LINK_CREATED", { linkId: link.id, fromObjectId, toObjectId, type })],
    };
    persist(next);
    set({ ...next, past: [...current.past, current], future: [] });
  },
  selectObject: (id) => set({ selectedObjectId: id }),
  undo: () => {
    const current = get();
    const previous = current.past[current.past.length - 1];
    if (!previous) return;
    const present = { objects: current.objects, links: current.links, events: current.events };
    persist(previous);
    set({ ...previous, past: current.past.slice(0, -1), future: [present, ...current.future], selectedObjectId: null });
  },
  redo: () => {
    const current = get();
    const next = current.future[0];
    if (!next) return;
    const present = { objects: current.objects, links: current.links, events: current.events };
    persist(next);
    set({ ...next, past: [...current.past, present], future: current.future.slice(1), selectedObjectId: null });
  },
}));

export { projectId };
