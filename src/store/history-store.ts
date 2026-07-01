/**
 * Agent Society — Mission History Store (LocalStorage)
 */

import { create } from "zustand";
import type { MissionHistoryEntry } from "@/types";

const STORAGE_KEY = "agent-society-history";

function loadHistory(): MissionHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as MissionHistoryEntry[] : [];
    return parsed.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index);
  } catch {
    return [];
  }
}

function saveHistory(entries: MissionHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch {
    // Storage full — ignore
  }
}

interface HistorySlice {
  entries: MissionHistoryEntry[];
  load: () => void;
  add: (entry: MissionHistoryEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useHistoryStore = create<HistorySlice>((set, get) => ({
  entries: [],

  load: () => set({ entries: loadHistory() }),

  add: (entry) => {
    const existing = get().entries.filter((current) => current.id !== entry.id);
    const updated = [entry, ...existing];
    set({ entries: updated });
    saveHistory(updated);
  },

  remove: (id) => {
    const updated = get().entries.filter((entry) => entry.id !== id);
    set({ entries: updated });
    saveHistory(updated);
  },

  clear: () => {
    set({ entries: [] });
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  },
}));
