import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { THEMES, type ThemeName, type ThemePalette } from "@/constants/themes";

type ThemeContextType = {
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
  colors: ThemePalette & { radius: number };
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeName, setThemeNameState] = useState<ThemeName>("blue");

  useEffect(() => {
    AsyncStorage.getItem("theme").then((v) => {
      if (v && v in THEMES) setThemeNameState(v as ThemeName);
    });
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem("theme", name);
  }, []);

  const theme = THEMES[themeName];
  const isDark = systemScheme === "dark";
  const palette = isDark ? theme.dark : theme.light;
  const colors = { ...palette, radius: theme.radius };

  return (
    <ThemeContext.Provider value={{ themeName, setTheme, colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
