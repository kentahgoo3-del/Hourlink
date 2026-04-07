export type ThemeName = "blue" | "dark-pro" | "forest" | "sunset" | "violet" | "slate";

export type ThemePalette = {
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

export type Theme = {
  name: ThemeName;
  label: string;
  emoji: string;
  light: ThemePalette;
  dark: ThemePalette;
  radius: number;
};

const base = {
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  success: "#10b981",
  successForeground: "#ffffff",
  warning: "#f59e0b",
  warningForeground: "#ffffff",
};

export const THEMES: Record<ThemeName, Theme> = {
  blue: {
    name: "blue",
    label: "Ocean Blue",
    emoji: "🔵",
    radius: 12,
    light: {
      ...base,
      text: "#0f172a", tint: "#2563eb",
      background: "#f8fafc", foreground: "#0f172a",
      card: "#ffffff", cardForeground: "#0f172a",
      primary: "#2563eb", primaryForeground: "#ffffff",
      secondary: "#f1f5f9", secondaryForeground: "#0f172a",
      muted: "#f1f5f9", mutedForeground: "#64748b",
      accent: "#dbeafe", accentForeground: "#1d4ed8",
      border: "#e2e8f0", input: "#e2e8f0",
    },
    dark: {
      ...base,
      text: "#f1f5f9", tint: "#3b82f6",
      background: "#0a0f1e", foreground: "#f1f5f9",
      card: "#111827", cardForeground: "#f1f5f9",
      primary: "#3b82f6", primaryForeground: "#ffffff",
      secondary: "#1e293b", secondaryForeground: "#f1f5f9",
      muted: "#1e293b", mutedForeground: "#94a3b8",
      accent: "#1e3a8a", accentForeground: "#93c5fd",
      border: "#1e293b", input: "#1e293b",
    },
  },

  "dark-pro": {
    name: "dark-pro",
    label: "Dark Pro",
    emoji: "⚫",
    radius: 10,
    light: {
      ...base,
      text: "#111111", tint: "#00d4ff",
      background: "#f5f5f5", foreground: "#111111",
      card: "#ffffff", cardForeground: "#111111",
      primary: "#0ea5e9", primaryForeground: "#ffffff",
      secondary: "#f0f0f0", secondaryForeground: "#111111",
      muted: "#efefef", mutedForeground: "#666666",
      accent: "#e0f7ff", accentForeground: "#0284c7",
      border: "#e0e0e0", input: "#e0e0e0",
    },
    dark: {
      ...base,
      text: "#e8e8e8", tint: "#00d4ff",
      background: "#0a0a0a", foreground: "#e8e8e8",
      card: "#141414", cardForeground: "#e8e8e8",
      primary: "#00d4ff", primaryForeground: "#000000",
      secondary: "#1a1a1a", secondaryForeground: "#e8e8e8",
      muted: "#1a1a1a", mutedForeground: "#888888",
      accent: "#0a2030", accentForeground: "#00d4ff",
      border: "#222222", input: "#222222",
    },
  },

  forest: {
    name: "forest",
    label: "Forest",
    emoji: "🌿",
    radius: 14,
    light: {
      ...base,
      text: "#0d2818", tint: "#16a34a",
      background: "#f0fdf4", foreground: "#0d2818",
      card: "#ffffff", cardForeground: "#0d2818",
      primary: "#16a34a", primaryForeground: "#ffffff",
      secondary: "#dcfce7", secondaryForeground: "#0d2818",
      muted: "#f0fdf4", mutedForeground: "#4b7a5c",
      accent: "#bbf7d0", accentForeground: "#15803d",
      border: "#d1fae5", input: "#d1fae5",
    },
    dark: {
      ...base,
      text: "#dcfce7", tint: "#22c55e",
      background: "#052e16", foreground: "#dcfce7",
      card: "#0a3d1f", cardForeground: "#dcfce7",
      primary: "#22c55e", primaryForeground: "#052e16",
      secondary: "#14532d", secondaryForeground: "#dcfce7",
      muted: "#14532d", mutedForeground: "#86efac",
      accent: "#15803d", accentForeground: "#bbf7d0",
      border: "#166534", input: "#166534",
    },
  },

  sunset: {
    name: "sunset",
    label: "Sunset",
    emoji: "🌅",
    radius: 16,
    light: {
      ...base,
      text: "#1c0a00", tint: "#ea580c",
      background: "#fff7ed", foreground: "#1c0a00",
      card: "#ffffff", cardForeground: "#1c0a00",
      primary: "#ea580c", primaryForeground: "#ffffff",
      secondary: "#ffedd5", secondaryForeground: "#1c0a00",
      muted: "#fff7ed", mutedForeground: "#7c4a1e",
      accent: "#fed7aa", accentForeground: "#c2410c",
      border: "#fed7aa", input: "#fed7aa",
    },
    dark: {
      ...base,
      text: "#ffedd5", tint: "#fb923c",
      background: "#1c0a00", foreground: "#ffedd5",
      card: "#2a1000", cardForeground: "#ffedd5",
      primary: "#fb923c", primaryForeground: "#1c0a00",
      secondary: "#3a1500", secondaryForeground: "#ffedd5",
      muted: "#3a1500", mutedForeground: "#fdba74",
      accent: "#7c2d12", accentForeground: "#fed7aa",
      border: "#431407", input: "#431407",
    },
  },

  violet: {
    name: "violet",
    label: "Violet",
    emoji: "💜",
    radius: 12,
    light: {
      ...base,
      text: "#150a2a", tint: "#7c3aed",
      background: "#faf5ff", foreground: "#150a2a",
      card: "#ffffff", cardForeground: "#150a2a",
      primary: "#7c3aed", primaryForeground: "#ffffff",
      secondary: "#f3e8ff", secondaryForeground: "#150a2a",
      muted: "#f3e8ff", mutedForeground: "#6b4a8a",
      accent: "#e9d5ff", accentForeground: "#6d28d9",
      border: "#e9d5ff", input: "#e9d5ff",
    },
    dark: {
      ...base,
      text: "#f3e8ff", tint: "#a78bfa",
      background: "#0f0518", foreground: "#f3e8ff",
      card: "#180a2a", cardForeground: "#f3e8ff",
      primary: "#a78bfa", primaryForeground: "#0f0518",
      secondary: "#2e1065", secondaryForeground: "#f3e8ff",
      muted: "#2e1065", mutedForeground: "#c4b5fd",
      accent: "#4c1d95", accentForeground: "#e9d5ff",
      border: "#3b0764", input: "#3b0764",
    },
  },

  slate: {
    name: "slate",
    label: "Slate",
    emoji: "🩶",
    radius: 8,
    light: {
      ...base,
      text: "#0f172a", tint: "#475569",
      background: "#f8fafc", foreground: "#0f172a",
      card: "#ffffff", cardForeground: "#0f172a",
      primary: "#475569", primaryForeground: "#ffffff",
      secondary: "#f1f5f9", secondaryForeground: "#0f172a",
      muted: "#f1f5f9", mutedForeground: "#64748b",
      accent: "#e2e8f0", accentForeground: "#334155",
      border: "#e2e8f0", input: "#e2e8f0",
    },
    dark: {
      ...base,
      text: "#f1f5f9", tint: "#94a3b8",
      background: "#020617", foreground: "#f1f5f9",
      card: "#0f172a", cardForeground: "#f1f5f9",
      primary: "#94a3b8", primaryForeground: "#020617",
      secondary: "#1e293b", secondaryForeground: "#f1f5f9",
      muted: "#1e293b", mutedForeground: "#94a3b8",
      accent: "#1e293b", accentForeground: "#cbd5e1",
      border: "#1e293b", input: "#1e293b",
    },
  },
};
