"use client";

import { create } from "zustand";

const STORAGE_KEY = "agent-society-runtime-settings";

interface RuntimeSettings {
  allowMockFallback: boolean;
  setAllowMockFallback: (enabled: boolean) => void;
  load: () => void;
}

function readAllowMockFallback() {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { allowMockFallback?: boolean }).allowMockFallback);
  } catch {
    return false;
  }
}

function saveAllowMockFallback(allowMockFallback: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ allowMockFallback }));
}

export const useRuntimeSettingsStore = create<RuntimeSettings>((set) => ({
  allowMockFallback: false,
  load: () => set({ allowMockFallback: readAllowMockFallback() }),
  setAllowMockFallback: (enabled) => {
    set({ allowMockFallback: enabled });
    saveAllowMockFallback(enabled);
  },
}));
