import { AppIcon } from "@/components/AppIcon";
import { useSubscription, type OfferingPackage } from "@/lib/revenuecat";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const FREE_FEATURES = [
  "1 active timer at a time",
  "Up to 3 clients",
  "Basic invoicing",
  "Time tracking & reports",
];

const PRO_FEATURES = [
  "Unlimited active timers",
  "Unlimited clients",
  "PDF export for reports & invoices",
  "Expense tracking",
  "Cash flow forecast",
  "All color themes",
];

const BUSINESS_FEATURES = [
  "Everything in Pro",
  "Smart Insights & PDF reports",
  "Team sync",
  "Client portal sync",
  "Batch invoicing",
];

function FeatureRow({ text, included = true, color }: { text: string; included?: boolean; color: string }) {
  const colors = useColors();
  return (
    <View style={styles.featureRow}>
      <AppIcon
        name={included ? "checkmark-circle" : "close-circle"}
        size={18}
        color={included ? color : colors.mutedForeground}
      />
      <Text style={[styles.featureText, { color: included ? colors.foreground : colors.mutedForeground }]}>
        {text}
      </Text>
    </View>
  );
}

function PlanCard({
  title,
  subtitle,
  price,
  features,
  color,
  badge,
  pkg,
  isCurrentPlan,
  isBelowCurrentPlan,
  onSubscribe,
}: {
  title: string;
  subtitle: string;
  price: string;
  features: string[];
  color: string;
  badge?: string;
  pkg?: OfferingPackage;
  isCurrentPlan: boolean;
  isBelowCurrentPlan: boolean;
  onSubscribe?: () => void;
}) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.planCard,
        {
          backgroundColor: colors.card,
          borderColor: isCurrentPlan ? color : colors.border,
          borderWidth: isCurrentPlan ? 2 : 1,
        },
      ]}
    >
      <View style={styles.planHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planTitle, { color: colors.foreground }]}>{title}</Text>
            {badge && (
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
            {isCurrentPlan && (
              <View style={[styles.badge, { backgroundColor: color }]}>
                <Text style={styles.badgeText}>Current Plan</Text>
              </View>
            )}
            {(() => {
              const intro = pkg?.product?.introductoryPrice;
              const hasTrial = !isCurrentPlan && (pkg?.introEligible ?? true) && !!intro && intro.periodNumberOfUnits > 0 && intro.periodUnit === "DAY";
              if (!hasTrial) return null;
              return (
                <View style={[styles.badge, styles.trialBadge]}>
                  <Text style={styles.badgeText}>{intro!.periodNumberOfUnits}-day free trial</Text>
                </View>
              );
            })()}
          </View>
          <Text style={[styles.planSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
        <View style={styles.priceBlock}>
          <Text style={[styles.price, { color: colors.foreground }]}>{price}</Text>
          {price !== "Free" && (
            <Text style={[styles.pricePer, { color: colors.mutedForeground }]}>/mo</Text>
          )}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {features.map((f) => (
        <FeatureRow key={f} text={f} color={color} />
      ))}

      {pkg && !isCurrentPlan && !isBelowCurrentPlan && (() => {
        const intro = pkg.product.introductoryPrice;
        const hasTrial = pkg.introEligible && !!intro && intro.periodNumberOfUnits > 0 && intro.periodUnit === "DAY";
        return (
          <TouchableOpacity
            style={[styles.subscribeBtn, { backgroundColor: color }]}
            onPress={onSubscribe}
            testID={`subscribe-${pkg.identifier}`}
          >
            <Text style={styles.subscribeBtnText}>
              {hasTrial ? `Try free for ${intro!.periodNumberOfUnits} days` : `Subscribe — ${price}/mo`}
            </Text>
          </TouchableOpacity>
        );
      })()}

      {isBelowCurrentPlan && (
        <View style={[styles.currentPlanNote, { backgroundColor: colors.muted }]}>
          <Text style={[styles.currentPlanNoteText, { color: colors.mutedForeground }]}>
            Included in your current plan
          </Text>
        </View>
      )}

      {isCurrentPlan && (
        <View style={[styles.currentPlanNote, { backgroundColor: color + "15" }]}>
          <AppIcon name="checkmark-circle" size={16} color={color} />
          <Text style={[styles.currentPlanNoteText, { color }]}>You're on this plan</Text>
        </View>
      )}
    </View>
  );
}

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPro, isBusiness, offering, loading, purchasePackage, restorePurchases } = useSubscription();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const proPkg = offering?.availablePackages.find(
    (p) => p.identifier === "$rc_monthly" || p.identifier === "pro_monthly"
  );

  const bizPkg = offering?.availablePackages.find(
    (p) => p.identifier === "business_monthly"
  );

  const proPrice = proPkg?.product.priceString ?? "";
  const bizPrice = bizPkg?.product.priceString ?? "";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="paywall-back">
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Choose Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading plans…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroWrap}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Unlock your full potential
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
              Start for free. Upgrade when you're ready.
            </Text>
          </View>

          <PlanCard
            title="Free"
            subtitle="Great for getting started"
            price="Free"
            features={FREE_FEATURES}
            color={colors.mutedForeground}
            isCurrentPlan={!isPro && !isBusiness}
            isBelowCurrentPlan={isPro || isBusiness}
          />

          {proPkg && (
            <PlanCard
              title="Pro"
              subtitle="For serious freelancers"
              price={proPrice}
              features={PRO_FEATURES}
              color="#3b82f6"
              badge="Most Popular"
              pkg={proPkg}
              isCurrentPlan={isPro && !isBusiness}
              isBelowCurrentPlan={isBusiness}
              onSubscribe={() => purchasePackage(proPkg)}
            />
          )}

          {bizPkg && (
            <PlanCard
              title="Business"
              subtitle="For growing agencies"
              price={bizPrice}
              features={BUSINESS_FEATURES}
              color="#8b5cf6"
              pkg={bizPkg}
              isCurrentPlan={isBusiness}
              isBelowCurrentPlan={false}
              onSubscribe={() => purchasePackage(bizPkg)}
            />
          )}

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={restorePurchases}
            testID="restore-purchases-btn"
          >
            <Text style={[styles.restoreBtnText, { color: colors.primary }]}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            Subscriptions renew automatically each month. Cancel anytime in your app store account settings. Prices shown in USD.
          </Text>
        </ScrollView>
      )}
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
  heroWrap: { alignItems: "center", paddingVertical: 8 },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 6 },
  heroSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  planCard: {
    borderRadius: 18,
    padding: 20,
    gap: 10,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  planTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  planSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trialBadge: {
    backgroundColor: "#22c55e",
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  priceBlock: { alignItems: "flex-end" },
  price: { fontSize: 26, fontFamily: "Inter_700Bold" },
  pricePer: { fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  subscribeBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  subscribeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  currentPlanNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  currentPlanNoteText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  restoreBtn: { alignItems: "center", paddingVertical: 12 },
  restoreBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  legalText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
