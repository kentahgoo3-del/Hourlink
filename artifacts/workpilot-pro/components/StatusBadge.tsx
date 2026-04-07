import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type StatusBadgeProps = {
  status: string;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#94a3b822", text: "#64748b" },
  sent: { label: "Sent", bg: "#3b82f622", text: "#2563eb" },
  accepted: { label: "Accepted", bg: "#10b98122", text: "#059669" },
  rejected: { label: "Rejected", bg: "#ef444422", text: "#dc2626" },
  paid: { label: "Paid", bg: "#10b98122", text: "#059669" },
  overdue: { label: "Overdue", bg: "#ef444422", text: "#dc2626" },
  active: { label: "Active", bg: "#10b98122", text: "#059669" },
  completed: { label: "Completed", bg: "#94a3b822", text: "#64748b" },
  paused: { label: "Paused", bg: "#f59e0b22", text: "#d97706" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "#94a3b822", text: "#64748b" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
});
