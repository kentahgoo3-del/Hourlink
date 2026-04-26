export type UIStyleName =
  | "default"
  | "minimal"
  | "darkpro"
  | "industrial"
  | "aurora"
  | "modular";

export type UIStylePalette = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  border: string;
  input: string;
  text: string;
  tint: string;
};

export type UIStyleDef = {
  name: UIStyleName;
  label: string;
  tagline: string;
  emoji: string;
  isDark: boolean;
  palette: UIStylePalette;
  radius: number;
  previewColors: string[];
};

const SHARED = {
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  success: "#10b981",
  successForeground: "#ffffff",
  warning: "#f59e0b",
  warningForeground: "#ffffff",
};

export const UI_STYLES: Record<UIStyleName, UIStyleDef> = {
  default: {
    name: "default",
    label: "Default",
    tagline: "Your chosen color theme",
    emoji: "🎨",
    isDark: false,
    radius: 12,
    previewColors: ["#2563eb", "#f1f5f9", "#ffffff", "#0f172a"],
    palette: {
      ...SHARED,
      background: "#f8fafc", foreground: "#0f172a",
      card: "#ffffff", cardForeground: "#0f172a",
      primary: "#2563eb", primaryForeground: "#ffffff",
      secondary: "#f1f5f9", secondaryForeground: "#0f172a",
      muted: "#f1f5f9", mutedForeground: "#64748b",
      accent: "#dbeafe", accentForeground: "#1d4ed8",
      border: "#e2e8f0", input: "#e2e8f0",
      text: "#0f172a", tint: "#2563eb",
    },
  },

  minimal: {
    name: "minimal",
    label: "Minimal Clean",
    tagline: "Apple-style · Clinical · Distraction-free",
    emoji: "⬜",
    isDark: false,
    radius: 14,
    previewColors: ["#007aff", "#f2f2f7", "#ffffff", "#000000"],
    palette: {
      ...SHARED,
      background: "#ffffff",
      foreground: "#000000",
      card: "#f2f2f7",
      cardForeground: "#000000",
      primary: "#007aff",
      primaryForeground: "#ffffff",
      secondary: "#f2f2f7",
      secondaryForeground: "#3c3c43",
      muted: "#e5e5ea",
      mutedForeground: "#8e8e93",
      accent: "#e3f0ff",
      accentForeground: "#007aff",
      border: "#c6c6c8",
      input: "#e5e5ea",
      text: "#000000",
      tint: "#007aff",
      success: "#34c759",
      successForeground: "#ffffff",
      warning: "#ff9500",
      warningForeground: "#ffffff",
      destructive: "#ff3b30",
      destructiveForeground: "#ffffff",
    },
  },

  darkpro: {
    name: "darkpro",
    label: "Dark Pro",
    tagline: "Engineering feel · Neon accents · Data-heavy",
    emoji: "🌐",
    isDark: true,
    radius: 10,
    previewColors: ["#00e5ff", "#0d1117", "#050508", "#a0c4ff"],
    palette: {
      ...SHARED,
      background: "#050508",
      foreground: "#e8f4ff",
      card: "#0d1117",
      cardForeground: "#e8f4ff",
      primary: "#00e5ff",
      primaryForeground: "#000000",
      secondary: "#111927",
      secondaryForeground: "#a0c4ff",
      muted: "#0d1a2a",
      mutedForeground: "#5a8fa0",
      accent: "#002030",
      accentForeground: "#00e5ff",
      border: "#1a2e40",
      input: "#111927",
      text: "#e8f4ff",
      tint: "#00e5ff",
      success: "#00ff88",
      successForeground: "#000000",
      warning: "#ffcc00",
      warningForeground: "#000000",
      destructive: "#ff4560",
      destructiveForeground: "#ffffff",
    },
  },

  industrial: {
    name: "industrial",
    label: "Industrial",
    tagline: "Bold · Practical · High-visibility",
    emoji: "🔶",
    isDark: true,
    radius: 4,
    previewColors: ["#f59e0b", "#1e1e1e", "#111111", "#ffffff"],
    palette: {
      ...SHARED,
      background: "#111111",
      foreground: "#ffffff",
      card: "#1e1e1e",
      cardForeground: "#ffffff",
      primary: "#f59e0b",
      primaryForeground: "#111111",
      secondary: "#2a2a2a",
      secondaryForeground: "#ffffff",
      muted: "#222222",
      mutedForeground: "#888888",
      accent: "#3a2800",
      accentForeground: "#f59e0b",
      border: "#333333",
      input: "#2a2a2a",
      text: "#ffffff",
      tint: "#f59e0b",
      success: "#4caf50",
      successForeground: "#ffffff",
      warning: "#ff9800",
      warningForeground: "#000000",
      destructive: "#f44336",
      destructiveForeground: "#ffffff",
    },
  },

  aurora: {
    name: "aurora",
    label: "Aurora Glass",
    tagline: "Premium · Futuristic · Glassmorphism",
    emoji: "🔮",
    isDark: true,
    radius: 22,
    previewColors: ["#c084fc", "#1a0d38", "#0d0621", "#e4d8ff"],
    palette: {
      ...SHARED,
      background: "#0d0621",
      foreground: "#f0e8ff",
      card: "#1a0d38",
      cardForeground: "#f0e8ff",
      primary: "#c084fc",
      primaryForeground: "#0d0621",
      secondary: "#1f0a44",
      secondaryForeground: "#e4d8ff",
      muted: "#160a30",
      mutedForeground: "#9c7ec4",
      accent: "#4a1070",
      accentForeground: "#e4d8ff",
      border: "#3d1870",
      input: "#1f0a44",
      text: "#f0e8ff",
      tint: "#c084fc",
      success: "#4ade80",
      successForeground: "#0d0621",
      warning: "#fbbf24",
      warningForeground: "#0d0621",
      destructive: "#f87171",
      destructiveForeground: "#0d0621",
    },
  },

  modular: {
    name: "modular",
    label: "Modular SaaS",
    tagline: "Modern · Colourful · Card-first",
    emoji: "🟦",
    isDark: false,
    radius: 18,
    previewColors: ["#6366f1", "#ede9fe", "#f8f6ff", "#1a1033"],
    palette: {
      ...SHARED,
      background: "#f8f6ff",
      foreground: "#1a1033",
      card: "#ffffff",
      cardForeground: "#1a1033",
      primary: "#6366f1",
      primaryForeground: "#ffffff",
      secondary: "#ede9fe",
      secondaryForeground: "#3730a3",
      muted: "#f4f2ff",
      mutedForeground: "#7c6fa6",
      accent: "#ddd6fe",
      accentForeground: "#4338ca",
      border: "#e0d9ff",
      input: "#ede9fe",
      text: "#1a1033",
      tint: "#6366f1",
      success: "#059669",
      successForeground: "#ffffff",
      warning: "#d97706",
      warningForeground: "#ffffff",
      destructive: "#dc2626",
      destructiveForeground: "#ffffff",
    },
  },
};
