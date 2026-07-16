export const SETTINGS_OPTIONS_STORAGE_KEY = "agent-society-settings-options";
export const CONNECTION_TEST_STORAGE_KEY = "agent-society-qwen-connection-test";
export const SETTINGS_CHANGED_EVENT = "agentSociety:settingsChanged";

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

const THEMES = ["System", "Dark", "OLED"] as const;
const ACCENTS = ["Cyan", "Purple", "Emerald"] as const;
const ANIMATION_LEVELS = ["Calm", "Balanced", "High"] as const;
const PARTICLE_DENSITIES = ["Low", "Medium", "High"] as const;
const GLASS_BLUR_LEVELS = ["Low", "Medium", "High"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionValue<T extends string>(value: unknown, options: readonly T[], fallback: string): string {
  return typeof value === "string" && options.includes(value as T) ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function normalizeSettingsOptions(value: unknown, fallback: SettingsOptions = DEFAULT_SETTINGS_OPTIONS): SettingsOptions {
  const input = isRecord(value) ? value : {};
  const preferences = isRecord(input.preferences) ? input.preferences : {};
  const appearance = isRecord(input.appearance) ? input.appearance : {};
  const preference = (key: keyof MissionPreferenceSettings) => typeof preferences[key] === "boolean"
    ? preferences[key] as boolean
    : fallback.preferences[key];

  return {
    preferences: {
      autoSaveReports: preference("autoSaveReports"),
      streamResponses: preference("streamResponses"),
      rememberContext: preference("rememberContext"),
      retryFailedRequests: preference("retryFailedRequests"),
      keyboardShortcuts: preference("keyboardShortcuts"),
      reduceMotion: preference("reduceMotion"),
      developerMode: preference("developerMode"),
      verboseLogs: preference("verboseLogs"),
      experimentalFeatures: preference("experimentalFeatures"),
    },
    appearance: {
      theme: optionValue(appearance.theme, THEMES, fallback.appearance.theme),
      accent: optionValue(appearance.accent, ACCENTS, fallback.appearance.accent),
      animation: optionValue(appearance.animation, ANIMATION_LEVELS, fallback.appearance.animation),
      particles: optionValue(appearance.particles, PARTICLE_DENSITIES, fallback.appearance.particles),
      glassBlur: optionValue(appearance.glassBlur, GLASS_BLUR_LEVELS, fallback.appearance.glassBlur),
    },
    missionTimeout: numberValue(input.missionTimeout, fallback.missionTimeout, 30, 300),
    retryCount: numberValue(input.retryCount, fallback.retryCount, 0, 5),
  };
}

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
  return normalizeSettingsOptions(saved);
}

export function saveSettingsOptions(options: SettingsOptions) {
  if (typeof window === "undefined") return;
  const normalized = normalizeSettingsOptions(options);
  localStorage.setItem(SETTINGS_OPTIONS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent<SettingsOptions>(SETTINGS_CHANGED_EVENT, { detail: normalized }));
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
  const theme = themeColors(appearance.theme);
  root.style.setProperty("--agent-background-start", theme.start);
  root.style.setProperty("--agent-background-middle", theme.middle);
  root.style.setProperty("--agent-background-end", theme.end);
  root.style.setProperty("--agent-animation-speed", animationSpeed(appearance.animation));
  root.style.setProperty("--background", theme.start);
}

function accentColor(accent: string) {
  if (accent === "Purple") return "168 85 247";
  if (accent === "Emerald") return "52 211 153";
  return "34 211 238";
}

function glassBlur(glassBlurLevel: string) {
  if (glassBlurLevel === "Low") return "0px";
  if (glassBlurLevel === "Medium") return "16px";
  return "36px";
}

function themeColors(theme: string) {
  if (theme === "OLED") return { start: "#000000", middle: "#02040a", end: "#000000" };
  if (theme === "Dark") return { start: "#030711", middle: "#07101f", end: "#030711" };
  return { start: "#070b14", middle: "#0c1425", end: "#070b14" };
}

function animationSpeed(level: string) {
  if (level === "Calm") return "1.5";
  if (level === "High") return "0.7";
  return "1";
}
