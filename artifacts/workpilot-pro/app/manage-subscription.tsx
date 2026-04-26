import { AppIcon } from "@/components/AppIcon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSubscription, type OfferingPackage } from "@/lib/revenuecat";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const IS_WEB = Platform.OS === "web";

const GOOGLE_PLAY_SUBS_URL =
  "https://play.google.com/store/account/subscriptions";

function formatDate(isoString: string | null): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function PlanBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View style={[badge.wrap, { backgroundColor: color + "20", borderColor: color + "40" }]}>
      <View style={[badge.dot, { backgroundColor: color }]} />
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});

function SwitchPlanCard({
  title,
  price,
  description,
  color,
  isCurrentPlan,
  onSelect,
}: {
  title: string;
  price: string;
  description: string;
  color: string;
  isCurrentPlan: boolean;
  onSelect?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.switchCard,
        {
          backgroundColor: colors.card,
          borderColor: isCurrentPlan ? color : colors.border,
          borderWidth: isCurrentPlan ? 2 : 1,
        },
      ]}
    >
      <View style={styles.switchCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.switchCardTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.switchCardDesc, { color: colors.mutedForeground }]}>{description}</Text>
        </View>
        <Text style={[styles.switchCardPrice, { color: isCurrentPlan ? color : colors.foreground }]}>
          {price}<Text style={[styles.switchCardPer, { color: colors.mutedForeground }]}>/mo</Text>
        </Text>
      </View>
      {isCurrentPlan ? (
        <View style={[styles.currentBadgeRow, { backgroundColor: color + "15" }]}>
          <AppIcon name="checkmark-circle" size={15} color={color} />
          <Text style={[styles.currentBadgeText, { color }]}>Current plan</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.switchBtn, { backgroundColor: color }]}
          onPress={onSelect}
          testID={`switch-to-${title.toLowerCase()}`}
        >
          <Text style={styles.switchBtnText}>Switch to {title}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ManageSubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    isPro,
    isBusiness,
    isSubscribed,
    nextBillingDate,
    offering,
    loading,
    purchasePackage,
    downgradeMockToFree,
  } = useSubscription();

  const [downgrading, setDowngrading] = useState(false);
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const planName = isBusiness ? "Business" : isPro ? "Pro" : "Free";
  const planColor = isBusiness ? "#8b5cf6" : isPro ? "#3b82f6" : colors.mutedForeground;

  const proPkg = offering?.availablePackages.find(
    (p) => p.identifier === "$rc_monthly" || p.identifier === "pro_monthly"
  );
  const bizPkg = offering?.availablePackages.find(
    (p) => p.identifier === "business_monthly"
  );

  const planPrice = isBusiness
    ? (bizPkg?.product.priceString ?? "$19.99")
    : isPro
    ? (proPkg?.product.priceString ?? "$9.99")
    : "Free";

  const handleSwitchPlan = (pkg: OfferingPackage) => {
    purchasePackage(pkg);
  };

  const handleCancelSubscription = () => {
    if (IS_WEB) {
      setShowDowngradeConfirm(true);
    } else {
      Linking.openURL(GOOGLE_PLAY_SUBS_URL).catch(() => {});
    }
  };

  const confirmDowngrade = async () => {
    setShowDowngradeConfirm(false);
    setDowngrading(true);
    try {
      await downgradeMockToFree();
      router.back();
    } finally {
      setDowngrading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <AppIcon name="chevron-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Manage Subscription</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading subscription…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="manage-sub-back">
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Manage Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isSubscribed ? (
          <>
            <View
              style={[
                styles.currentPlanCard,
                { backgroundColor: planColor + "10", borderColor: planColor + "40" },
              ]}
            >
              <View style={[styles.planIconCircle, { backgroundColor: planColor }]}>
                <AppIcon name="star" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <PlanBadge label="Active" color="#22c55e" />
                <Text style={[styles.currentPlanName, { color: colors.foreground }]}>
                  {planName} Plan
                </Text>
                <Text style={[styles.currentPlanPrice, { color: planColor }]}>
                  {planPrice}
                  <Text style={[styles.currentPlanPer, { color: colors.mutedForeground }]}>/month</Text>
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoRow}>
                <AppIcon name="calendar-outline" size={18} color={colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Next billing date</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {formatDate(nextBillingDate)}
                  </Text>
                </View>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <AppIcon name="card-outline" size={18} color={colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Billing amount</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    {planPrice} per month
                  </Text>
                </View>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoRow}>
                <AppIcon name="refresh-circle-outline" size={18} color={colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Renewal</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>
                    Renews automatically each month
                  </Text>
                </View>
              </View>
            </View>

            {IS_WEB && (
              <View style={[styles.webModeBadge, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                <AppIcon name="flask-outline" size={15} color="#92400e" />
                <Text style={[styles.webModeBadgeText, { color: "#92400e" }]}>
                  Web mock mode — no real charges
                </Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Change Plan</Text>

            {proPkg && (
              <SwitchPlanCard
                title="Pro"
                price={proPkg.product.priceString}
                description="Unlimited timers, PDF export, expenses, all themes"
                color="#3b82f6"
                isCurrentPlan={isPro && !isBusiness}
                onSelect={() => handleSwitchPlan(proPkg)}
              />
            )}

            {bizPkg && (
              <SwitchPlanCard
                title="Business"
                price={bizPkg.product.priceString}
                description="Everything in Pro plus Smart Insights, team sync, and batch invoicing"
                color="#8b5cf6"
                isCurrentPlan={isBusiness}
                onSelect={() => handleSwitchPlan(bizPkg)}
              />
            )}

            <View style={[styles.cancelSection, { borderColor: colors.border }]}>
              <Text style={[styles.cancelTitle, { color: colors.foreground }]}>
                {IS_WEB ? "Downgrade to Free" : "Cancel Subscription"}
              </Text>
              <Text style={[styles.cancelHint, { color: colors.mutedForeground }]}>
                {IS_WEB
                  ? "In web mock mode, this resets your plan to Free immediately."
                  : "To cancel, manage your subscription directly in Google Play. Your access continues until the end of the billing period."}
              </Text>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  { borderColor: "#ef4444" },
                  downgrading && styles.disabledBtn,
                ]}
                onPress={handleCancelSubscription}
                disabled={downgrading}
                testID="cancel-subscription-btn"
              >
                {downgrading ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <AppIcon
                      name={IS_WEB ? "arrow-down-circle-outline" : "open-outline"}
                      size={16}
                      color="#ef4444"
                    />
                    <Text style={styles.cancelBtnText}>
                      {IS_WEB ? "Downgrade to Free" : "Manage in Google Play"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noSubWrap}>
            <View style={[styles.noSubIcon, { backgroundColor: colors.muted }]}>
              <AppIcon name="star-outline" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.noSubTitle, { color: colors.foreground }]}>No Active Subscription</Text>
            <Text style={[styles.noSubHint, { color: colors.mutedForeground }]}>
              You are on the Free plan. Upgrade to Pro or Business to unlock all features.
            </Text>
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: "#3b82f6" }]}
              onPress={() => router.replace("/paywall")}
              testID="upgrade-from-manage-btn"
            >
              <Text style={styles.upgradeBtnText}>View Plans</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={showDowngradeConfirm}
        title="Downgrade to Free"
        message="This will remove your Pro/Business access immediately (web mock mode). Continue?"
        confirmLabel="Downgrade to Free"
        cancelLabel="Keep Plan"
        destructive
        onConfirm={confirmDowngrade}
        onCancel={() => setShowDowngradeConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  currentPlanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  planIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  currentPlanName: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 6, marginBottom: 2 },
  currentPlanPrice: { fontSize: 26, fontFamily: "Inter_700Bold" },
  currentPlanPer: { fontSize: 14, fontFamily: "Inter_400Regular" },
  infoCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  infoDivider: { height: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2, letterSpacing: 0.2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  webModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  webModeBadgeText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  switchCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  switchCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  switchCardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 3 },
  switchCardDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  switchCardPrice: { fontSize: 22, fontFamily: "Inter_700Bold" },
  switchCardPer: { fontSize: 12, fontFamily: "Inter_400Regular" },
  currentBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 9,
  },
  currentBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  switchBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  switchBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  cancelSection: {
    borderTopWidth: 1,
    paddingTop: 20,
    gap: 10,
    marginTop: 4,
  },
  cancelTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cancelHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#ef4444" },
  disabledBtn: { opacity: 0.5 },
  noSubWrap: { alignItems: "center", paddingVertical: 40, gap: 14 },
  noSubIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  noSubTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  noSubHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 16,
  },
  upgradeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    marginTop: 4,
  },
  upgradeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
