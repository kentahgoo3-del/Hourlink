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

interface RCCustomerInfo {
  entitlements: {
    active: Record<string, unknown>;
  };
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
  };
}

interface RCRawOffering {
  identifier: string;
  availablePackages?: RCPackage[];
}

interface RCOfferings {
  current: RCRawOffering | null;
}

interface RCPurchasesModule {
  configure(options: { apiKey: string }): void;
  getCustomerInfo(): Promise<RCCustomerInfo>;
  getOfferings(): Promise<RCOfferings>;
  purchasePackage(pkg: RCPackage): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
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
type MockTier = "free" | "pro" | "business";

export type OfferingPackage = {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    title: string;
    description: string;
  };
};

export type SubOffering = {
  identifier: string;
  availablePackages: OfferingPackage[];
};

export type SubscriptionState = {
  isPro: boolean;
  isBusiness: boolean;
  isSubscribed: boolean;
  offering: SubOffering | null;
  offerings: SubOffering | null;
  loading: boolean;
  openPaywall: () => void;
  purchasePackage: (pkg: OfferingPackage) => Promise<void>;
  purchase: (pkg: OfferingPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  restore: () => Promise<void>;
  refreshSubscription: () => void;
};

const SubscriptionContext = createContext<SubscriptionState | null>(null);

async function fetchSubState(): Promise<{ isPro: boolean; isBusiness: boolean; offering: SubOffering | null }> {
  if (IS_WEB || !RNPurchases) {
    const tier = (await AsyncStorage.getItem(MOCK_TIER_KEY)) as MockTier | null;
    return {
      isPro: tier === "pro" || tier === "business",
      isBusiness: tier === "business",
      offering: getMockOffering(),
    };
  }

  try {
    const [customerInfo, rcOfferings] = await Promise.all([
      RNPurchases.getCustomerInfo(),
      RNPurchases.getOfferings(),
    ]);
    const active = customerInfo?.entitlements?.active ?? {};
    const isPro = !!active["pro"] || !!active["business"];
    const isBusiness = !!active["business"];
    const current: SubOffering | null = rcOfferings?.current
      ? normalizeOffering(rcOfferings.current)
      : null;
    return { isPro, isBusiness, offering: current };
  } catch (err: unknown) {
    console.warn("[RevenueCat] fetch error:", err instanceof Error ? err.message : String(err));
    return { isPro: false, isBusiness: false, offering: null };
  }
}

function getMockOffering(): SubOffering {
  return {
    identifier: "default",
    availablePackages: [
      {
        identifier: "$rc_monthly",
        product: {
          identifier: "pro_monthly",
          priceString: "$9.99",
          title: "Pro Monthly",
          description: "Unlimited timers, PDF export, expenses, all themes",
        },
      },
      {
        identifier: "business_monthly",
        product: {
          identifier: "business_monthly",
          priceString: "$19.99",
          title: "Business Monthly",
          description: "Everything in Pro plus Smart Insights, team sync, client portal sync, batch invoicing",
        },
      },
    ],
  };
}

function normalizeOffering(raw: RCRawOffering): SubOffering {
  return {
    identifier: raw.identifier,
    availablePackages: (raw.availablePackages ?? []).map((pkg: RCPackage) => ({
      identifier: pkg.identifier,
      product: {
        identifier: pkg.product?.identifier ?? pkg.identifier,
        priceString: pkg.product?.priceString ?? "—",
        title: pkg.product?.localizedTitle ?? pkg.product?.title ?? pkg.identifier,
        description: pkg.product?.localizedDescription ?? pkg.product?.description ?? "",
      },
    })),
  };
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
      } else {
        const rcOfferings = await RNPurchases.getOfferings();
        const nativePkg = rcOfferings?.current?.availablePackages?.find(
          (p: RCPackage) => p.identifier === confirmPkg.identifier
        );
        if (!nativePkg) throw new Error("Package not found in current offering");
        await RNPurchases.purchasePackage(nativePkg);
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
    offering: data?.offering ?? null,
    offerings: data?.offering ?? null,
    loading: isLoading,
    openPaywall,
    purchasePackage,
    purchase: purchasePackage,
    restorePurchases,
    restore: restorePurchases,
    refreshSubscription,
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
      offering: null,
      offerings: null,
      loading: false,
      openPaywall: () => {},
      purchasePackage: async () => {},
      purchase: async () => {},
      restorePurchases: async () => {},
      restore: async () => {},
      refreshSubscription: () => {},
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
          <Text style={ms.price}>{pkg.product.priceString}<Text style={ms.pricePer}>/month</Text></Text>
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
              {purchasing ? "Processing…" : `Subscribe — ${pkg.product.priceString}/mo`}
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
            Subscription renews automatically. Cancel anytime.
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
});
