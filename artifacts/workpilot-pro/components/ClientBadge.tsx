import React from "react";
import { StyleSheet, Text, View } from "react-native";

type ClientBadgeProps = {
  name: string;
  color: string;
  size?: "sm" | "md";
};

export function ClientBadge({ name, color, size = "md" }: ClientBadgeProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dim = size === "sm" ? 28 : 36;
  const fontSize = size === "sm" ? 11 : 13;

  return (
    <View style={[styles.badge, { backgroundColor: color + "22", width: dim, height: dim, borderRadius: dim / 2 }]}>
      <Text style={[styles.text, { color, fontSize, fontFamily: "Inter_700Bold" }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {},
});
