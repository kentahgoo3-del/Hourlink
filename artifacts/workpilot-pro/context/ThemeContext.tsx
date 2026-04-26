import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { THEMES, type ThemeName, type ThemePalette } from "@/constants/themes";

export type AppearanceSettings = {
  accentColor: string | null;
  fontSize: "small" | "medium" | "large";
  density: "compact" | "normal" | "spacious";
  cornerRadius: "sharp" | "rounded" | "pill";
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  accentColor: null,
  fontSize: "medium",
  density: "normal",
  cornerRadius: "rounded",
};

const FS_MAP: Record<string, number> = { small: 0.84, medium: 1, large: 1.18 };
const SP_MAP: Record<string, number> = { compact: 0.76, normal: 1, spacious: 1.28 };
const CR_MAP: Record<string, number> = { sharp: 5, rounded: 14, pill: 28 };

type ThemeContextType = {
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  colors: ThemePalette & { radius: number; fs: number; sp: number; cr: number };
  isDark: boolean;
  appearance: AppearanceSettings;
  setAppearance: (s: Partial<AppearanceSettings>) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeName, setThemeNameState] = useState<ThemeName>("blue");
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    AsyncStorage.getItem("theme").then((v) => {
      if (v && v in THEMES) setThemeNameState(v as ThemeName);
    });
    AsyncStorage.getItem("appearance").then((v) => {
      if (v) {
        try { setAppearanceState({ ...DEFAULT_APPEARANCE, ...JSON.parse(v) }); } catch {}
      }
    });
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem("theme", name);
  }, []);

  const setAppearance = useCallback((s: Partial<AppearanceSettings>) => {
    setAppearanceState((prev) => {
      const next = { ...prev, ...s };
      AsyncStorage.setItem("appearance", JSON.stringify(next));
      return next;
    });
  }, []);

  const theme = THEMES[themeName];
  const isDark = systemScheme === "dark";
  const palette = isDark ? theme.dark : theme.light;

  const primary = appearance.accentColor ?? palette.primary;
  const fs = FS_MAP[appearance.fontSize] ?? 1;
  const sp = SP_MAP[appearance.density] ?? 1;
  const cr = CR_MAP[appearance.cornerRadius] ?? 14;

  const colors = {
    ...palette,
    primary,
    tint: appearance.accentColor ?? palette.tint,
    radius: cr,
    fs,
    sp,
    cr,
  };

  return (
    <ThemeContext.Provider value={{ themeName, setTheme, colors, isDark, appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
