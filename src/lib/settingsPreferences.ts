export const SETTINGS_OPTIONS_STORAGE_KEY = "agent-society-settings-options";
export const CONNECTION_TEST_STORAGE_KEY = "agent-society-qwen-connection-test";

export interface MissionPreferenceSettings {
  autoSaveReports: boolean;
  streamResponses: boolean;
  rememberContext: boolean;
  retryFailedRequests: boolean;
  keyboardShortcuts: boolean;
  reduceMotion: boolean;
  developerMode: boolean;
  verboseLogs: boolean;
  experimentalFeatures: boolean;
}

export interface AppearanceSettings {
  theme: string;
  accent: string;
  animation: string;
  particles: string;
  glassBlur: string;
}

export interface SettingsOptions {
  preferences: MissionPreferenceSettings;
  appearance: AppearanceSettings;
  missionTimeout: number;
  retryCount: number;
}

export interface ConnectionTestState {
  status: "idle" | "connected";
  latencyMs: number | null;
  modelAvailable: boolean | null;
  verifiedAt: string | null;
  fingerprint: string;
}

export const DEFAULT_SETTINGS_OPTIONS: SettingsOptions = {
  preferences: {
    autoSaveReports: true,
    streamResponses: true,
    rememberContext: true,
    retryFailedRequests: true,
    keyboardShortcuts: true,
    reduceMotion: false,
    developerMode: false,
    verboseLogs: false,
    experimentalFeatures: false,
  },
  appearance: {
    theme: "System",
    accent: "Cyan",
    animation: "Balanced",
    particles: "Medium",
    glassBlur: "High",
  },
  missionTimeout: 120,
  retryCount: 2,
};

export const DEFAULT_CONNECTION_TEST: ConnectionTestState = {
  status: "idle",
  latencyMs: null,
  modelAvailable: null,
  verifiedAt: null,
  fingerprint: "",
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
}

export function getSavedSettingsOptions(): SettingsOptions {
  const saved = readJson<Partial<SettingsOptions>>(SETTINGS_OPTIONS_STORAGE_KEY, {});
  return {
    preferences: { ...DEFAULT_SETTINGS_OPTIONS.preferences, ...(saved.preferences ?? {}) },
    appearance: { ...DEFAULT_SETTINGS_OPTIONS.appearance, ...(saved.appearance ?? {}) },
    missionTimeout: typeof saved.missionTimeout === "number" ? saved.missionTimeout : DEFAULT_SETTINGS_OPTIONS.missionTimeout,
    retryCount: typeof saved.retryCount === "number" ? saved.retryCount : DEFAULT_SETTINGS_OPTIONS.retryCount,
  };
}

export function saveSettingsOptions(options: SettingsOptions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_OPTIONS_STORAGE_KEY, JSON.stringify(options));
}

export function resetSettingsOptions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SETTINGS_OPTIONS_STORAGE_KEY);
  applyAppearanceSettings(DEFAULT_SETTINGS_OPTIONS.appearance, DEFAULT_SETTINGS_OPTIONS.preferences);
}

export function getSavedConnectionTest(fingerprint: string): ConnectionTestState {
  const saved = readJson<ConnectionTestState>(CONNECTION_TEST_STORAGE_KEY, DEFAULT_CONNECTION_TEST);
  return saved.fingerprint === fingerprint ? saved : DEFAULT_CONNECTION_TEST;
}

export function saveConnectionTest(state: ConnectionTestState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONNECTION_TEST_STORAGE_KEY, JSON.stringify(state));
}

export function clearConnectionTest() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONNECTION_TEST_STORAGE_KEY);
}

export function runtimeFingerprint(settings: { source: string; qwenBaseUrl: string; qwenModel: string; maskedApiKey: string }) {
  return `${settings.source}:${settings.qwenBaseUrl}:${settings.qwenModel}:${settings.maskedApiKey}`;
}

export function applyAppearanceSettings(appearance: AppearanceSettings, preferences: Pick<MissionPreferenceSettings, "reduceMotion">) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.agentTheme = appearance.theme.toLowerCase();
  root.dataset.agentAccent = appearance.accent.toLowerCase();
  root.dataset.agentAnimation = appearance.animation.toLowerCase();
  root.dataset.agentParticles = appearance.particles.toLowerCase();
  root.dataset.agentGlassBlur = appearance.glassBlur.toLowerCase();
  root.dataset.agentReduceMotion = preferences.reduceMotion ? "true" : "false";
  root.style.setProperty("--agent-settings-accent", accentColor(appearance.accent));
  root.style.setProperty("--agent-settings-blur", glassBlur(appearance.glassBlur));
}

function accentColor(accent: string) {
  if (accent === "Purple") return "168 85 247";
  if (accent === "Emerald") return "52 211 153";
  return "34 211 238";
}

function glassBlur(glassBlurLevel: string) {
  if (glassBlurLevel === "Low") return "10px";
  if (glassBlurLevel === "Medium") return "18px";
  return "28px";
}
