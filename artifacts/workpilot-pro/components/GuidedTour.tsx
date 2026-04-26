import { AppIcon } from "@/components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const TOUR_KEY = "@hourlink_tour_completed_v2";
const { width: W, height: H } = Dimensions.get("window");

type TourStep = {
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  position: "top" | "center" | "bottom";
  tabIndex?: number;
};

const STEPS: TourStep[] = [
  {
    title: "Welcome to HourLink!",
    description: "Let's take a quick tour through the app. HourLink covers time tracking, invoicing, tasks, team workspaces, and a web client portal — all in one place.",
    icon: "rocket-outline",
    iconColor: "#2dd4bf",
    position: "center",
  },
  {
    title: "Home Dashboard",
    description: "Your command centre. See weekly hours, revenue, active timers, billing alerts, and top clients at a glance. Billing stats can be hidden in Settings if you prefer a simpler view.",
    icon: "home-outline",
    iconColor: "#3b82f6",
    position: "bottom",
    tabIndex: 0,
  },
  {
    title: "Time Tracking",
    description: "Start a timer with one tap, assign it to a client, and mark it billable. Need to fix a past entry? Tap the pencil icon on any stopped entry to correct the start or end time.",
    icon: "timer-outline",
    iconColor: "#f59e0b",
    position: "bottom",
    tabIndex: 1,
  },
  {
    title: "Task Management",
    description: "Create tasks, assign priorities and due dates, and drag them through a Kanban board. Link tasks to clients and start a timer directly from any task card.",
    icon: "checkmark-circle-outline",
    iconColor: "#22c55e",
    position: "bottom",
    tabIndex: 2,
  },
  {
    title: "Client Management",
    description: "Add clients with individual hourly rates, contact details, and notes. Track total revenue, invoice history, and unbilled time per client all in one place.",
    icon: "people-outline",
    iconColor: "#8b5cf6",
    position: "bottom",
    tabIndex: 3,
  },
  {
    title: "Finance — Invoices & Quotes",
    description: "Send a quote, convert it to an invoice on approval, and pull in tracked hours with one tap. Export professional PDFs and mark payments as they arrive.",
    icon: "document-text-outline",
    iconColor: "#ec4899",
    position: "bottom",
    tabIndex: 4,
  },
  {
    title: "Reports & Analytics",
    description: "View detailed breakdowns of time, revenue, and expenses by client, task, or date range. Export shareable PDF reports straight from this tab.",
    icon: "bar-chart-outline",
    iconColor: "#0ea5e9",
    position: "bottom",
    tabIndex: 5,
  },
  {
    title: "Team Workspaces",
    description: "Create a shared workspace and invite collaborators using a short join code. Team members can track time and manage tasks together, with owner and member roles keeping things organised.",
    icon: "people-circle-outline",
    iconColor: "#4ade80",
    position: "center",
  },
  {
    title: "Client Portal",
    description: "Share the web portal at hour-link.com with your clients or team members. They can view task boards, track progress, and add comments — without needing the mobile app.",
    icon: "globe-outline",
    iconColor: "#38bdf8",
    position: "center",
  },
  {
    title: "Quick Actions",
    description: "From the Home tab, use Quick Actions to instantly start a timer, add a client, create an invoice, or log an expense. Everything reachable in one tap.",
    icon: "flash-outline",
    iconColor: "#f97316",
    position: "center",
  },
  {
    title: "Settings & Customisation",
    description: "Set your profile, company branding, currency, and theme. Under Billing, toggle billing features on or off entirely if you only need time tracking. Access Settings from the gear icon on Home.",
    icon: "settings-outline",
    iconColor: "#6366f1",
    position: "center",
  },
  {
    title: "You're all set!",
    description: "Start by adding your first client, then track some time. Your data stays private on your device, with shared data synced securely through the HourLink server. Replay this tour anytime from Settings.",
    icon: "checkmark-circle-outline",
    iconColor: "#22c55e",
    position: "center",
  },
];

interface GuidedTourProps {
  visible: boolean;
  onDismiss: () => void;
}

export function GuidedTour({ visible, onDismiss }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    if (visible) {
      setStep(0);
      animateIn();
    }
  }, [visible]);

  const animateIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStep((s) => s + 1);
        animateIn();
      });
    } else {
      completeTour();
    }
  }, [step, fadeAnim, animateIn]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setStep((s) => s - 1);
        animateIn();
      });
    }
  }, [step, fadeAnim, animateIn]);

  const completeTour = useCallback(async () => {
    try { await AsyncStorage.setItem(TOUR_KEY, "true"); } catch {}
    onDismiss();
  }, [onDismiss]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const getTooltipPosition = () => {
    if (current.position === "bottom") return { bottom: Platform.OS === "web" ? 100 : 120 };
    if (current.position === "top") return { top: 120 };
    return { top: H * 0.25 };
  };

  const tabBarHighlightLeft = current.tabIndex !== undefined
    ? (current.tabIndex / 6) * W + (W / 6 / 2) - 30
    : -100;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={completeTour}
      />

      {current.tabIndex !== undefined && (
        <View style={[styles.tabHighlight, { left: tabBarHighlightLeft, bottom: Platform.OS === "web" ? 48 : 30 }]}>
          <View style={[styles.tabHighlightRing, { borderColor: current.iconColor }]} />
        </View>
      )}

      <Animated.View
        style={[
          styles.tooltip,
          getTooltipPosition(),
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: current.iconColor + "20" }]}>
          <AppIcon name={current.icon} size={28} color={current.iconColor} />
        </View>

        <Text style={styles.stepCounter}>
          {step + 1} of {STEPS.length}
        </Text>

        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>

        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === step ? { backgroundColor: current.iconColor, width: 20 } : { backgroundColor: "#ffffff40" },
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonRow}>
          {!isFirst && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={goPrev}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {isFirst && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={completeTour}>
              <Text style={styles.secondaryBtnText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: current.iconColor }]}
            onPress={goNext}
          >
            <Text style={styles.primaryBtnText}>
              {isLast ? "Get Started" : "Next"}
            </Text>
            {!isLast && <AppIcon name="chevron-forward" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

export async function shouldShowTour(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(TOUR_KEY);
    return val !== "true";
  } catch { return true; }
}

export async function resetTour(): Promise<void> {
  try { await AsyncStorage.removeItem(TOUR_KEY); } catch {}
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  tooltip: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  stepCounter: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#ffffff80",
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#ffffffcc",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  progressDot: {
    height: 4,
    width: 8,
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffffff30",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#ffffffcc",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  tabHighlight: {
    position: "absolute",
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  tabHighlightRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
});
