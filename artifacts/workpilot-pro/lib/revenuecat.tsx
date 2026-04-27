import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "@/lib/navigate";
import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const IS_WEB = Platform.OS === "web";

interface RCEntitlement {
  expirationDate?: string | null;
  latestPurchaseDate?: string | null;
  originalPurchaseDate?: string | null;
  [key: string]: unknown;
}

interface RCCustomerInfo {
  originalAppUserId?: string;
  entitlements: {
    active: Record<string, RCEntitlement>;
    all: Record<string, RCEntitlement>;
  };
}

interface RCIntroductoryPrice {
  priceString: string;
  periodNumberOfUnits: number;
  periodUnit: string;
}

interface RCPackage {
  identifier: string;
  product?: {
    identifier?: string;
    priceString?: string;
    localizedTitle?: string;
    title?: string;
    localizedDescription?: string;
    description?: string;
    introductoryPrice?: RCIntroductoryPrice | null;
  };
}

interface RCRawOffering {
  identifier: string;
  availablePackages?: RCPackage[];
}

interface RCOfferings {
  current: RCRawOffering | null;
}

interface RCMakePurchaseResult {
  customerInfo?: RCCustomerInfo;
}

interface RCIntroEligibility {
  status: number;
}

const RC_INTRO_ELIGIBILITY_STATUS = {
  UNKNOWN: 0,
  INELIGIBLE: 1,
  ELIGIBLE: 2,
  NO_INTRO_OFFER_EXISTS: 3,
} as const;

interface RCPurchasesModule {
  configure(options: { apiKey: string }): void;
  getCustomerInfo(): Promise<RCCustomerInfo>;
  getOfferings(): Promise<RCOfferings>;
  purchasePackage(pkg: RCPackage): Promise<RCMakePurchaseResult>;
  restorePurchases(): Promise<unknown>;
  checkTrialOrIntroductoryPriceEligibility(productIdentifiers: string[]): Promise<Record<string, RCIntroEligibility>>;
}

function isRCPurchaseError(e: unknown): e is { userCancelled: boolean; message?: string } {
  return typeof e === "object" && e !== null && "userCancelled" in e;
}

let RNPurchases: RCPurchasesModule | null = null;
if (!IS_WEB) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RNPurchases = require("react-native-purchases").default as RCPurchasesModule;
  } catch {
    // SDK not available in this environment (web build or simulator without native module)
  }
}

export function initializeRevenueCat() {
  if (IS_WEB || !RNPurchases) return;
  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) {
    console.warn("[RevenueCat] No API key found for platform", Platform.OS);
    return;
  }
  RNPurchases.configure({ apiKey });
}

const MOCK_TIER_KEY = "rc_mock_tier";
const MOCK_TRIAL_USED_KEY = "rc_mock_trial_used";
const MOCK_BILLING_HISTORY_KEY = "rc_mock_billing_history";
type MockTier = "free" | "pro" | "business";

export type IntroductoryOffer = {
  priceString: string;
  periodNumberOfUnits: number;
  periodUnit: string;
};

export type OfferingPackage = {
  identifier: string;
  introEligible: boolean;
  product: {
    identifier: string;
    priceString: string;
    title: string;
    description: string;
    introductoryPrice?: IntroductoryOffer | null;
  };
};

export type SubOffering = {
  identifier: string;
  availablePackages: OfferingPackage[];
};

export type BillingTransaction = {
  date: string;
  amount: string;
  status: "Paid";
};

export type SubscriptionState = {
  isPro: boolean;
  isBusiness: boolean;
  isSubscribed: boolean;
  nextBillingDate: string | null;
  billingHistory: BillingTransaction[];
  offering: SubOffering | null;
  offerings: SubOffering | null;
  loading: boolean;
  openPaywall: () => void;
  openManageSubscription: () => void;
  purchasePackage: (pkg: OfferingPackage) => Promise<void>;
  purchase: (pkg: OfferingPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  restore: () => Promise<void>;
  refreshSubscription: () => void;
  downgradeMockToFree: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionState | null>(null);

type FetchSubResult = {
  isPro: boolean;
  isBusiness: boolean;
  nextBillingDate: string | null;
  billingHistory: BillingTransaction[];
  offering: SubOffering | null;
};

function buildMockBillingHistory(tier: MockTier | null, nextBillingDate: string | null): BillingTransaction[] {
  if (tier !== "pro" && tier !== "business") return [];
  const amount = tier === "business" ? "$19.99" : "$9.99";
  const anchor = nextBillingDate ? new Date(nextBillingDate) : new Date();
  const rows: BillingTransaction[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(anchor);
    d.setMonth(d.getMonth() - i);
    rows.push({ date: d.toISOString(), amount, status: "Paid" });
  }
  return rows;
}

async function fetchSubState(): Promise<FetchSubResult> {
  if (IS_WEB || !RNPurchases) {
    const tier = (await AsyncStorage.getItem(MOCK_TIER_KEY)) as MockTier | null;
    const trialUsed = (await AsyncStorage.getItem(MOCK_TRIAL_USED_KEY)) === "true";
    const isActive = tier === "pro" || tier === "business";
    let mockNextBillingDate: string | null = null;
    if (isActive) {
      const stored = await AsyncStorage.getItem("rc_mock_next_billing");
      if (stored) {
        mockNextBillingDate = stored;
      } else {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        mockNextBillingDate = next.toISOString();
        await AsyncStorage.setItem("rc_mock_next_billing", mockNextBillingDate);
      }
    }
    let billingHistory: BillingTransaction[];
    if (isActive) {
      billingHistory = buildMockBillingHistory(tier, mockNextBillingDate);
      await AsyncStorage.setItem(MOCK_BILLING_HISTORY_KEY, JSON.stringify(billingHistory));
    } else {
      const stored = await AsyncStorage.getItem(MOCK_BILLING_HISTORY_KEY);
      billingHistory = stored ? (JSON.parse(stored) as BillingTransaction[]) : [];
    }
    return {
      isPro: isActive,
      isBusiness: tier === "business",
      nextBillingDate: mockNextBillingDate,
      billingHistory,
      offering: getMockOffering(!trialUsed),
    };
  }

  try {
    const [customerInfo, rcOfferings] = await Promise.all([
      RNPurchases.getCustomerInfo(),
      RNPurchases.getOfferings(),
    ]);
    const active = customerInfo?.entitlements?.active ?? {};
    const all = customerInfo?.entitlements?.all ?? {};
    const isPro = !!active["pro"] || !!active["business"];
    const isBusiness = !!active["business"];
    const activeEntitlement = active["business"] ?? active["pro"] ?? null;
    const nextBillingDate = activeEntitlement?.expirationDate ?? null;

    let eligibilityMap: Record<string, RCIntroEligibility> = {};
    if (rcOfferings?.current?.availablePackages) {
      const productIds = rcOfferings.current.availablePackages
        .map((p: RCPackage) => p.product?.identifier)
        .filter(Boolean) as string[];
      if (productIds.length > 0) {
        try {
          eligibilityMap = await RNPurchases.checkTrialOrIntroductoryPriceEligibility(productIds);
        } catch {
          console.warn("[RevenueCat] checkTrialOrIntroductoryPriceEligibility failed; defaulting all packages to eligible");
        }
      }
    }

    const current: SubOffering | null = rcOfferings?.current
      ? normalizeOffering(rcOfferings.current, eligibilityMap)
      : null;

    const billingHistory = buildNativeBillingHistory(all, active);

    return { isPro, isBusiness, nextBillingDate, billingHistory, offering: current };
  } catch (err: unknown) {
    console.warn("[RevenueCat] fetch error:", err instanceof Error ? err.message : String(err));
    return { isPro: false, isBusiness: false, nextBillingDate: null, billingHistory: [], offering: null };
  }
}

function buildNativeBillingHistory(
  all: Record<string, RCEntitlement>,
  active: Record<string, RCEntitlement>
): BillingTransaction[] {
  const rows: BillingTransaction[] = [];
  const seen = new Set<string>();

  const addEntitlementRows = (_key: string, ent: RCEntitlement, amount: string) => {
    const dates = [ent.latestPurchaseDate, ent.originalPurchaseDate].filter(Boolean) as string[];
    for (const d of dates) {
      if (!seen.has(d)) {
        seen.add(d);
        rows.push({ date: d, amount, status: "Paid" });
      }
    }
  };

  if (all["business"]) addEntitlementRows("business", all["business"], "$19.99");
  if (all["pro"]) addEntitlementRows("pro", all["pro"], "$9.99");

  if (rows.length === 0) {
    const activeEnt = active["business"] ?? active["pro"] ?? null;
    if (activeEnt?.latestPurchaseDate) {
      rows.push({ date: activeEnt.latestPurchaseDate, amount: activeEnt === active["business"] ? "$19.99" : "$9.99", status: "Paid" });
    }
  }

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows;
}

function getMockOffering(proTrialEligible = true): SubOffering {
  return {
    identifier: "default",
    availablePackages: [
      {
        identifier: "$rc_monthly",
        introEligible: proTrialEligible,
        product: {
          identifier: "pro_monthly",
          priceString: "$9.99",
          title: "Pro Monthly",
          description: "Unlimited timers, PDF export, expenses, all themes",
          introductoryPrice: {
            priceString: "$0.00",
            periodNumberOfUnits: 7,
            periodUnit: "DAY",
          },
        },
      },
      {
        identifier: "business_monthly",
        introEligible: false,
        product: {
          identifier: "business_monthly",
          priceString: "$19.99",
          title: "Business Monthly",
          description: "Everything in Pro plus Smart Insights, team sync, client portal sync, batch invoicing",
          introductoryPrice: null,
        },
      },
    ],
  };
}

function normalizeOffering(raw: RCRawOffering, eligibilityMap: Record<string, RCIntroEligibility> = {}): SubOffering {
  return {
    identifier: raw.identifier,
    availablePackages: (raw.availablePackages ?? []).map((pkg: RCPackage) => {
      const productId = pkg.product?.identifier ?? pkg.identifier;
      const eligibility = eligibilityMap[productId];
      const introEligible = eligibility
        ? eligibility.status === RC_INTRO_ELIGIBILITY_STATUS.ELIGIBLE
        : true;
      return {
        identifier: pkg.identifier,
        introEligible,
        product: {
          identifier: productId,
          priceString: pkg.product?.priceString ?? "—",
          title: pkg.product?.localizedTitle ?? pkg.product?.title ?? pkg.identifier,
          description: pkg.product?.localizedDescription ?? pkg.product?.description ?? "",
          introductoryPrice: pkg.product?.introductoryPrice ?? null,
        },
      };
    }),
  };
}

async function sendReceiptEmail(
  pkg: OfferingPackage,
  opts: { appUserId: string } | { webMock: true }
): Promise<void> {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return;

  const settingsRaw = await AsyncStorage.getItem("settings");
  const settings: { email?: string } = settingsRaw ? JSON.parse(settingsRaw) : {};
  const email = settings.email;
  if (!email || !email.includes("@") || email === "you@example.com") return;

  const isBusiness = pkg.identifier === "business_monthly";
  const planName = isBusiness ? "Business Monthly" : "Pro Monthly";

  const res = await fetch(`https://${domain}/api/subscription/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, planName, ...opts }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.warn("[receipt] delivery failed", res.status, body);
  }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [confirmPkg, setConfirmPkg] = useState<OfferingPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubState,
    staleTime: 30_000,
    retry: 1,
  });

  const refreshSubscription = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
    refetch();
  }, [queryClient, refetch]);

  const openPaywall = useCallback(() => {
    navigate("/paywall");
  }, []);

  const openManageSubscription = useCallback(() => {
    navigate("/manage-subscription");
  }, []);

  const downgradeMockToFree = useCallback(async () => {
    await AsyncStorage.removeItem(MOCK_TIER_KEY);
    await AsyncStorage.removeItem("rc_mock_next_billing");
    refreshSubscription();
  }, [refreshSubscription]);

  const purchasePackage = useCallback(async (pkg: OfferingPackage) => {
    setConfirmPkg(pkg);
  }, []);

  const confirmPurchase = useCallback(async () => {
    if (!confirmPkg) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      if (IS_WEB || !RNPurchases) {
        const tier: MockTier =
          confirmPkg.identifier === "business_monthly" ? "business" : "pro";
        await AsyncStorage.setItem(MOCK_TIER_KEY, tier);
        if (tier === "pro" && confirmPkg.introEligible) {
          await AsyncStorage.setItem(MOCK_TRIAL_USED_KEY, "true");
        }
        sendReceiptEmail(confirmPkg, { webMock: true }).catch(() => {});
      } else {
        const rcOfferings = await RNPurchases.getOfferings();
        const nativePkg = rcOfferings?.current?.availablePackages?.find(
          (p: RCPackage) => p.identifier === confirmPkg.identifier
        );
        if (!nativePkg) throw new Error("Package not found in current offering");
        const result = await RNPurchases.purchasePackage(nativePkg);
        const appUserId = result?.customerInfo?.originalAppUserId;
        if (appUserId) {
          sendReceiptEmail(confirmPkg, { appUserId }).catch(() => {});
        }
      }
      setConfirmPkg(null);
      refreshSubscription();
    } catch (err: unknown) {
      if (isRCPurchaseError(err) && err.userCancelled) {
        setConfirmPkg(null);
        return;
      }
      const message = err instanceof Error ? err.message : "Purchase failed. Please try again.";
      setPurchaseError(message);
    } finally {
      setPurchasing(false);
    }
  }, [confirmPkg, refreshSubscription]);

  const restorePurchases = useCallback(async () => {
    if (IS_WEB || !RNPurchases) return;
    try {
      await RNPurchases.restorePurchases();
      refreshSubscription();
    } catch (err: unknown) {
      console.warn("[RevenueCat] restore error:", err instanceof Error ? err.message : String(err));
    }
  }, [refreshSubscription]);

  const state: SubscriptionState = {
    isPro: data?.isPro ?? false,
    isBusiness: data?.isBusiness ?? false,
    isSubscribed: (data?.isPro || data?.isBusiness) ?? false,
    nextBillingDate: data?.nextBillingDate ?? null,
    billingHistory: data?.billingHistory ?? [],
    offering: data?.offering ?? null,
    offerings: data?.offering ?? null,
    loading: isLoading,
    openPaywall,
    openManageSubscription,
    purchasePackage,
    purchase: purchasePackage,
    restorePurchases,
    restore: restorePurchases,
    refreshSubscription,
    downgradeMockToFree,
  };

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
      <PurchaseConfirmModal
        pkg={confirmPkg}
        purchasing={purchasing}
        error={purchaseError}
        onConfirm={confirmPurchase}
        onCancel={() => {
          setConfirmPkg(null);
          setPurchaseError(null);
        }}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    return {
      isPro: false,
      isBusiness: false,
      isSubscribed: false,
      nextBillingDate: null,
      billingHistory: [],
      offering: null,
      offerings: null,
      loading: false,
      openPaywall: () => {},
      openManageSubscription: () => {},
      purchasePackage: async () => {},
      purchase: async () => {},
      restorePurchases: async () => {},
      restore: async () => {},
      refreshSubscription: () => {},
      downgradeMockToFree: async () => {},
    };
  }
  return ctx;
}

function PurchaseConfirmModal({
  pkg,
  purchasing,
  error,
  onConfirm,
  onCancel,
}: {
  pkg: OfferingPackage | null;
  purchasing: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pkg) return null;
  const isBusiness = pkg.identifier === "business_monthly";
  const accentColor = isBusiness ? "#8b5cf6" : "#3b82f6";
  const intro = pkg.product.introductoryPrice;
  const hasTrial = !isBusiness && pkg.introEligible && !!intro && intro.periodNumberOfUnits > 0 && intro.periodUnit === "DAY";
  const trialDays = hasTrial ? intro!.periodNumberOfUnits : 0;

  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          <View style={[ms.iconCircle, { backgroundColor: accentColor + "20" }]}>
            <Text style={ms.iconEmoji}>{isBusiness ? "🚀" : "⚡"}</Text>
          </View>

          <Text style={ms.planName}>
            {isBusiness ? "Business Plan" : "Pro Plan"}
          </Text>

          {hasTrial ? (
            <View style={ms.trialPriceBlock}>
              <Text style={ms.trialFreeLabel}>Free for {trialDays} days</Text>
              <Text style={ms.trialThenLabel}>then {pkg.product.priceString}/mo</Text>
            </View>
          ) : (
            <Text style={ms.price}>{pkg.product.priceString}<Text style={ms.pricePer}>/month</Text></Text>
          )}

          {hasTrial ? (
            <Text style={ms.trialStartsText}>Your trial starts today</Text>
          ) : null}

          <Text style={ms.desc}>{pkg.product.description}</Text>

          {IS_WEB && (
            <View style={ms.testBadge}>
              <Text style={ms.testBadgeText}>Test Mode — no real charge</Text>
            </View>
          )}

          {error && (
            <View style={ms.errorBox}>
              <Text style={ms.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[ms.confirmBtn, { backgroundColor: accentColor }, purchasing && ms.disabledBtn]}
            onPress={onConfirm}
            disabled={purchasing}
            testID="purchase-confirm-btn"
          >
            <Text style={ms.confirmBtnText}>
              {purchasing
                ? "Processing…"
                : hasTrial
                  ? `Try free for ${trialDays} days`
                  : `Subscribe — ${pkg.product.priceString}/mo`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={ms.cancelBtn}
            onPress={onCancel}
            disabled={purchasing}
            testID="purchase-cancel-btn"
          >
            <Text style={ms.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={ms.legalText}>
            {hasTrial
              ? `After your ${trialDays}-day free trial, you'll be charged ${pkg.product.priceString}/mo unless cancelled.`
              : "Subscription renews automatically. Cancel anytime."}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconEmoji: { fontSize: 28 },
  planName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
    marginBottom: 4,
  },
  price: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
    marginBottom: 8,
  },
  pricePer: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#64748b",
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  testBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  testBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#92400e",
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    width: "100%",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#991b1b",
    textAlign: "center",
  },
  confirmBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  disabledBtn: { opacity: 0.6 },
  confirmBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  cancelBtn: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#64748b",
  },
  legalText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  trialPriceBlock: {
    alignItems: "center",
    marginBottom: 4,
  },
  trialFreeLabel: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#0f172a",
  },
  trialThenLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#64748b",
  },
  trialStartsText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#22c55e",
    marginBottom: 12,
  },
});
