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

export type QwenApiStatus =
  | "unchecked"
  | "connected"
  | "key-exhausted"
  | "invalid-key"
  | "rate-limited"
  | "unavailable"
  | "request-error";

export function isQwenApiStatusBlocking(
  status: QwenApiStatus,
): status is Exclude<QwenApiStatus, "unchecked" | "connected"> {
  return status !== "unchecked" && status !== "connected";
}

export function getQwenApiStatusLabel(status: QwenApiStatus) {
  if (status === "key-exhausted") return "Key Exhausted";
  if (status === "invalid-key") return "Invalid Key";
  if (status === "rate-limited") return "Rate Limited";
  if (status === "unavailable") return "Unavailable";
  if (status === "request-error") return "Request Error";
  if (status === "connected") return "Connected";
  return "Ready";
}

interface RuntimeSettings {
  allowMockFallback: boolean;
  developerDebugMode: boolean;
  qwenApiKey: string;
  qwenBaseUrl: string;
  qwenModel: string;
  qwenApiStatus: QwenApiStatus;
  qwenApiStatusMessage: string;
  setAllowMockFallback: (enabled: boolean) => void;
  setDeveloperDebugMode: (enabled: boolean) => void;
  setQwenCredentials: (credentials: { apiKey: string; baseUrl: string; model: string }) => void;
  setQwenApiStatus: (status: QwenApiStatus, message?: string) => void;
  clearQwenCredentials: () => void;
  load: () => void;
}

interface PersistedRuntimeSettings {
  allowMockFallback?: boolean;
  developerDebugMode?: boolean;
  qwenApiStatus?: QwenApiStatus;
  qwenApiStatusMessage?: string;
}

function readSettings(): Pick<RuntimeSettings, "allowMockFallback" | "developerDebugMode" | "qwenApiKey" | "qwenBaseUrl" | "qwenModel" | "qwenApiStatus" | "qwenApiStatusMessage"> {
  const fallback = {
    allowMockFallback: false,
    developerDebugMode: false,
    qwenApiStatus: "unchecked" as QwenApiStatus,
    qwenApiStatusMessage: "",
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
      qwenApiStatus: parsed.qwenApiStatus ?? "unchecked",
      qwenApiStatusMessage: parsed.qwenApiStatusMessage ?? "",
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
  qwenApiStatus: "unchecked",
  qwenApiStatusMessage: "",
  load: () => set(readSettings()),
  setAllowMockFallback: (enabled) => {
    saveSettings({ allowMockFallback: enabled });
    set({ allowMockFallback: enabled });
  },
  setDeveloperDebugMode: (enabled) => {
    saveSettings({ developerDebugMode: enabled });
    set({ developerDebugMode: enabled });
  },
  setQwenApiStatus: (status, message = "") => {
    saveSettings({ qwenApiStatus: status, qwenApiStatusMessage: message });
    set({ qwenApiStatus: status, qwenApiStatusMessage: message });
  },
  setQwenCredentials: ({ apiKey, baseUrl, model }) => {
    const next = {
      qwenApiKey: apiKey.trim(),
      qwenBaseUrl: baseUrl.trim() || DEFAULT_QWEN_BASE_URL,
      qwenModel: model.trim() || DEFAULT_QWEN_MODEL,
      qwenApiStatus: "unchecked" as QwenApiStatus,
      qwenApiStatusMessage: "",
    };
    saveQwenSettings(next);
    saveSettings({ qwenApiStatus: "unchecked", qwenApiStatusMessage: "" });
    set(next);
  },
  clearQwenCredentials: () => {
    clearSavedQwenKey();
    saveSettings({ qwenApiStatus: "unchecked", qwenApiStatusMessage: "" });
    set({
      qwenApiKey: "",
      qwenApiStatus: "unchecked",
      qwenApiStatusMessage: "",
    });
  },
}));
