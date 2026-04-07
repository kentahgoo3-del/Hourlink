import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  color?: string;
};

export function StatCard({ label, value, sub, color }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: color || colors.primary }]} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: colors.mutedForeground }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    minWidth: 140,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
