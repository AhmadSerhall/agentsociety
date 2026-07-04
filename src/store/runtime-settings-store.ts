"use client";

import { create } from "zustand";
import {
  DEFAULT_QWEN_BASE_URL,
  DEFAULT_QWEN_MODEL,
  QWEN_SETTINGS_STORAGE_KEY,
  clearSavedQwenKey,
  getSavedQwenSettings,
  saveQwenSettings,
} from "@/lib/qwenConfig";

interface RuntimeSettings {
  allowMockFallback: boolean;
  developerDebugMode: boolean;
  qwenApiKey: string;
  qwenBaseUrl: string;
  qwenModel: string;
  setAllowMockFallback: (enabled: boolean) => void;
  setDeveloperDebugMode: (enabled: boolean) => void;
  setQwenCredentials: (credentials: { apiKey: string; baseUrl: string; model: string }) => void;
  clearQwenCredentials: () => void;
  load: () => void;
}

interface PersistedRuntimeSettings {
  allowMockFallback?: boolean;
  developerDebugMode?: boolean;
}

function readSettings(): Pick<RuntimeSettings, "allowMockFallback" | "developerDebugMode" | "qwenApiKey" | "qwenBaseUrl" | "qwenModel"> {
  const fallback = {
    allowMockFallback: false,
    developerDebugMode: false,
    ...getSavedQwenSettings(),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(QWEN_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedRuntimeSettings;
    return {
      allowMockFallback: Boolean(parsed.allowMockFallback),
      developerDebugMode: Boolean(parsed.developerDebugMode),
      ...getSavedQwenSettings(),
    };
  } catch {
    return fallback;
  }
}

function saveSettings(settings: PersistedRuntimeSettings) {
  if (typeof window === "undefined") return;
  const current = readSettings();
  localStorage.setItem(QWEN_SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
}

export const useRuntimeSettingsStore = create<RuntimeSettings>((set) => ({
  allowMockFallback: false,
  developerDebugMode: false,
  qwenApiKey: "",
  qwenBaseUrl: DEFAULT_QWEN_BASE_URL,
  qwenModel: DEFAULT_QWEN_MODEL,
  load: () => set(readSettings()),
  setAllowMockFallback: (enabled) => {
    saveSettings({ allowMockFallback: enabled });
    set({ allowMockFallback: enabled });
  },
  setDeveloperDebugMode: (enabled) => {
    saveSettings({ developerDebugMode: enabled });
    set({ developerDebugMode: enabled });
  },
  setQwenCredentials: ({ apiKey, baseUrl, model }) => {
    const next = {
      qwenApiKey: apiKey.trim(),
      qwenBaseUrl: baseUrl.trim() || DEFAULT_QWEN_BASE_URL,
      qwenModel: model.trim() || DEFAULT_QWEN_MODEL,
    };
    saveQwenSettings(next);
    set(next);
  },
  clearQwenCredentials: () => {
    clearSavedQwenKey();
    set({
      qwenApiKey: "",
    });
  },
}));
