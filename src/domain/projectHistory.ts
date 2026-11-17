export type ProjectHistoryEntry = {
  id: string;
  title: string;
  idea: string;
  updatedAt: string;
};

const storageKey = "praxis-project-history";

function isEntry(value: unknown): value is ProjectHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.title === "string" && typeof entry.idea === "string" && typeof entry.updatedAt === "string";
}

export function readProjectHistory(): ProjectHistoryEntry[] {
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function saveProjectHistory(title: string, idea: string): ProjectHistoryEntry[] {
  const entry: ProjectHistoryEntry = {
    id: crypto.randomUUID(),
    title: title.trim() || "Untitled opportunity",
    idea: idea.trim(),
    updatedAt: new Date().toISOString(),
  };
  const history = readProjectHistory().filter((item) => item.title !== entry.title || item.idea !== entry.idea);
  const next = [entry, ...history].slice(0, 20);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
