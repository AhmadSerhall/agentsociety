export const QWEN_SETTINGS_STORAGE_KEY = "agent-society-runtime-settings";
export const API_KEY_ONBOARDING_HIDE_KEY = "agentSociety_hideApiKeyOnboarding";
export const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_QWEN_MODEL = "qwen-turbo";
export const QWEN_API_KEY_URL = "https://bailian.console.aliyun.com/?apiKey=1#/api-key";

export type QwenKeySource = "saved" | "env" | "none";

export interface QwenSettings {
  qwenApiKey: string;
  qwenBaseUrl: string;
  qwenModel: string;
}

export interface ResolvedQwenSettings extends QwenSettings {
  source: QwenKeySource;
  maskedApiKey: string;
}

interface PersistedRuntimeSettings extends Partial<QwenSettings> {
  allowMockFallback?: boolean;
  developerDebugMode?: boolean;
}

function getImportMetaEnv() {
  return (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
}

function readPersistedSettings(): PersistedRuntimeSettings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(QWEN_SETTINGS_STORAGE_KEY) ?? "{}") as PersistedRuntimeSettings;
  } catch {
    return {};
  }
}

function writePersistedSettings(settings: PersistedRuntimeSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QWEN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}••••••••`;
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
}

export function getSavedQwenSettings(): QwenSettings {
  const saved = readPersistedSettings();
  return {
    qwenApiKey: saved.qwenApiKey?.trim() ?? "",
    qwenBaseUrl: saved.qwenBaseUrl?.trim() || DEFAULT_QWEN_BASE_URL,
    qwenModel: saved.qwenModel?.trim() || DEFAULT_QWEN_MODEL,
  };
}

export function saveQwenSettings(settings: QwenSettings) {
  const current = readPersistedSettings();
  writePersistedSettings({
    ...current,
    qwenApiKey: settings.qwenApiKey.trim(),
    qwenBaseUrl: settings.qwenBaseUrl.trim() || DEFAULT_QWEN_BASE_URL,
    qwenModel: settings.qwenModel.trim() || DEFAULT_QWEN_MODEL,
  });
}

export function clearSavedQwenKey() {
  const current = readPersistedSettings();
  writePersistedSettings({ ...current, qwenApiKey: "" });
}

export function getEnvQwenSettings(): QwenSettings {
  const importMetaEnv = getImportMetaEnv();
  return {
    qwenApiKey: importMetaEnv.VITE_QWEN_API_KEY || process.env.VITE_QWEN_API_KEY || "",
    qwenBaseUrl: importMetaEnv.VITE_QWEN_BASE_URL || process.env.VITE_QWEN_BASE_URL || DEFAULT_QWEN_BASE_URL,
    qwenModel: importMetaEnv.VITE_QWEN_MODEL || process.env.VITE_QWEN_MODEL || DEFAULT_QWEN_MODEL,
  };
}

export function getResolvedQwenSettings(): ResolvedQwenSettings {
  const saved = getSavedQwenSettings();
  const env = getEnvQwenSettings();
  const hasSavedKey = Boolean(saved.qwenApiKey);
  const hasEnvKey = Boolean(env.qwenApiKey.trim());
  const resolved = hasSavedKey ? saved : hasEnvKey ? env : { ...saved, qwenApiKey: "" };
  return {
    ...resolved,
    source: hasSavedKey ? "saved" : hasEnvKey ? "env" : "none",
    maskedApiKey: maskApiKey(resolved.qwenApiKey),
  };
}

export function hasUsableQwenKey() {
  return Boolean(getResolvedQwenSettings().qwenApiKey.trim());
}

export function isApiKeyOnboardingHidden() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(API_KEY_ONBOARDING_HIDE_KEY) === "true";
}

export function hideApiKeyOnboardingPermanently() {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEY_ONBOARDING_HIDE_KEY, "true");
}
