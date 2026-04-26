import { AppIcon } from "@/components/AppIcon";
import { useColors } from "@/hooks/useColors";
import { useSubscription } from "@/lib/revenuecat";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  requiredPlan?: "pro" | "business";
  title: string;
  description: string;
};

export function UpgradeModal({ visible, onClose, requiredPlan = "pro", title, description }: Props) {
  const colors = useColors();
  const { openPaywall } = useSubscription();
  const accent = requiredPlan === "business" ? "#8b5cf6" : "#3b82f6";
  const planLabel = requiredPlan === "business" ? "Business" : "Pro";

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <View style={ms.overlay}>
        <View style={[ms.sheet, { backgroundColor: colors.card }]}>
          <View style={[ms.iconCircle, { backgroundColor: accent + "20" }]}>
            <Text style={ms.lockEmoji}>🔒</Text>
          </View>

          <View style={[ms.planBadge, { backgroundColor: accent }]}>
            <Text style={ms.planBadgeText}>{planLabel} Feature</Text>
          </View>

          <Text style={[ms.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[ms.desc, { color: colors.mutedForeground }]}>{description}</Text>

          <TouchableOpacity
            style={[ms.upgradeBtn, { backgroundColor: accent }]}
            onPress={() => { onClose(); openPaywall(); }}
            testID="upgrade-modal-btn"
          >
            <AppIcon name="star-outline" size={16} color="#fff" />
            <Text style={ms.upgradeBtnText}>Upgrade to {planLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
            <Text style={[ms.cancelBtnText, { color: colors.mutedForeground }]}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  lockEmoji: { fontSize: 26 },
  planBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    width: "100%",
    justifyContent: "center",
    marginBottom: 10,
  },
  upgradeBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  cancelBtn: { paddingVertical: 10, width: "100%", alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
