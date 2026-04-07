import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const { colors } = useTheme();
  return colors;
}
