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
    return raw ? JSON.parse(raw) : [];
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
  clear: () => void;
}

export const useHistoryStore = create<HistorySlice>((set, get) => ({
  entries: [],

  load: () => set({ entries: loadHistory() }),

  add: (entry) => {
    const updated = [entry, ...get().entries];
    set({ entries: updated });
    saveHistory(updated);
  },

  clear: () => {
    set({ entries: [] });
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  },
}));