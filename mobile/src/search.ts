import type { SortMode, UIDEntry } from "./types";

export type FilterKey = "all" | "ok" | "failed" | "ig" | "saved" | "password";

function truthy(value?: string) {
  return value === "true" || value === "1" || value === "yes";
}

export function matchesCommandQuery(entry: UIDEntry, query: string): boolean {
  const parts = query.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return true;
  const generic: string[] = [];

  for (const raw of parts) {
    const token = raw.toLowerCase();
    if (token.startsWith("status:")) {
      const value = token.slice(7);
      if (value === "ok" || value === "success") {
        if (entry.status !== "success") return false;
      } else if (value === "error" || value === "failed") {
        if (entry.status !== "error") return false;
      } else if (value === "pending" || value === "wait") {
        if (entry.status !== "pending") return false;
      }
      continue;
    }
    if (token.startsWith("saved:")) {
      if (Boolean(entry.saved) !== truthy(token.slice(6))) return false;
      continue;
    }
    if (token.startsWith("ig:")) {
      if (Boolean(entry.hasInstagram) !== truthy(token.slice(3))) return false;
      continue;
    }
    if (token.startsWith("pass:") || token.startsWith("password:")) {
      const value = token.includes("password:") ? token.slice(9) : token.slice(5);
      if (Boolean(entry.hasPassword) !== truthy(value)) return false;
      continue;
    }
    if (token.startsWith("date:")) {
      const value = token.slice(5);
      if (!entry.fetchedAt?.startsWith(value)) return false;
      continue;
    }
    if (token.startsWith("@")) {
      if (!(entry.username || "").toLowerCase().includes(token.slice(1))) return false;
      continue;
    }
    generic.push(token);
  }

  if (!generic.length) return true;
  const haystack = [entry.uid, entry.name, entry.username, entry.collection, ...(entry.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return generic.every((token) => haystack.includes(token));
}

export function filterByChip(entry: UIDEntry, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "ok") return entry.status === "success";
  if (filter === "failed") return entry.status === "error";
  if (filter === "ig") return Boolean(entry.hasInstagram);
  if (filter === "saved") return Boolean(entry.saved);
  if (filter === "password") return Boolean(entry.hasPassword);
  return true;
}

export function sortUIDs(entries: UIDEntry[], mode: SortMode) {
  return [...entries].sort((a, b) => {
    if (mode === "name") return (a.name || a.uid).localeCompare(b.name || b.uid);
    if (mode === "status") {
      const weight = { error: 0, pending: 1, success: 2 } as const;
      return weight[a.status] - weight[b.status];
    }
    return (b.fetchedAt || b.updatedAt || "").localeCompare(a.fetchedAt || a.updatedAt || "");
  });
}
