import React from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  color?: string;
};

export function StatCard({ label, value, sub, color }: StatCardProps) {
  const colors = useColors();
  const { fs, sp, cr } = colors;

  return (
    <View
      style={{
        flex: 1,
        borderRadius: cr,
        padding: Math.round(16 * sp),
        borderWidth: 1,
        minWidth: 130,
        backgroundColor: colors.card,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          marginBottom: Math.round(8 * sp),
          backgroundColor: color || colors.primary,
        }}
      />
      <Text
        style={{
          fontSize: Math.round(11 * fs),
          fontFamily: "Inter_500Medium",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 4,
          color: colors.mutedForeground,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: Math.round(22 * fs),
          fontFamily: "Inter_700Bold",
          marginBottom: 2,
          color: colors.foreground,
        }}
      >
        {value}
      </Text>
      {sub ? (
        <Text
          style={{
            fontSize: Math.round(12 * fs),
            fontFamily: "Inter_400Regular",
            color: colors.mutedForeground,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
