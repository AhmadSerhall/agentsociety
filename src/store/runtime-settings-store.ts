"use client";

import { create } from "zustand";

const STORAGE_KEY = "agent-society-runtime-settings";
const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_MODEL = "qwen-turbo";

interface RuntimeSettings {
  allowMockFallback: boolean;
  qwenApiKey: string;
  qwenBaseUrl: string;
  qwenModel: string;
  setAllowMockFallback: (enabled: boolean) => void;
  setQwenCredentials: (credentials: { apiKey: string; baseUrl: string; model: string }) => void;
  clearQwenCredentials: () => void;
  load: () => void;
}

interface PersistedRuntimeSettings {
  allowMockFallback?: boolean;
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;
}

function readSettings(): Pick<RuntimeSettings, "allowMockFallback" | "qwenApiKey" | "qwenBaseUrl" | "qwenModel"> {
  const fallback = {
    allowMockFallback: false,
    qwenApiKey: "",
    qwenBaseUrl: DEFAULT_QWEN_BASE_URL,
    qwenModel: DEFAULT_QWEN_MODEL,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedRuntimeSettings;
    return {
      allowMockFallback: Boolean(parsed.allowMockFallback),
      qwenApiKey: parsed.qwenApiKey ?? "",
      qwenBaseUrl: parsed.qwenBaseUrl ?? DEFAULT_QWEN_BASE_URL,
      qwenModel: parsed.qwenModel ?? DEFAULT_QWEN_MODEL,
    };
  } catch {
    return fallback;
  }
}

function saveSettings(settings: PersistedRuntimeSettings) {
  if (typeof window === "undefined") return;
  const current = readSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
}

export const useRuntimeSettingsStore = create<RuntimeSettings>((set) => ({
  allowMockFallback: false,
  qwenApiKey: "",
  qwenBaseUrl: DEFAULT_QWEN_BASE_URL,
  qwenModel: DEFAULT_QWEN_MODEL,
  load: () => set(readSettings()),
  setAllowMockFallback: (enabled) => {
    saveSettings({ allowMockFallback: enabled });
    set({ allowMockFallback: enabled });
  },
  setQwenCredentials: ({ apiKey, baseUrl, model }) => {
    const next = {
      qwenApiKey: apiKey.trim(),
      qwenBaseUrl: baseUrl.trim() || DEFAULT_QWEN_BASE_URL,
      qwenModel: model.trim() || DEFAULT_QWEN_MODEL,
    };
    saveSettings(next);
    set(next);
  },
  clearQwenCredentials: () => {
    const next = {
      qwenApiKey: "",
      qwenBaseUrl: DEFAULT_QWEN_BASE_URL,
      qwenModel: DEFAULT_QWEN_MODEL,
    };
    saveSettings(next);
    set(next);
  },
}));
