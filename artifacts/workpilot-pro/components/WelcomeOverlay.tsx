import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ND = Platform.OS !== "web";

type Page =
  | { type: "image"; title: string; subtitle: string }
  | {
      type: "color";
      bgColor: string;
      accentColor: string;
      iconName: keyof typeof Ionicons.glyphMap;
      iconColor: string;
      title: string;
      body: string;
    };

const PAGES: Page[] = [
  {
    type: "image",
    title: "WorkPilot Pro",
    subtitle: "Track & earn for every hour worked",
  },
  {
    type: "color",
    bgColor: "#0c4040",
    accentColor: "#14b8a6",
    iconName: "timer-outline",
    iconColor: "#5eead4",
    title: "Track Every Hour",
    body: "Start timers with one tap. Every billable minute is automatically saved so you never lose an hour of earned income again.",
  },
  {
    type: "color",
    bgColor: "#1a1040",
    accentColor: "#6366f1",
    iconName: "document-text-outline",
    iconColor: "#a5b4fc",
    title: "Invoice in Seconds",
    body: "Turn tracked time into professional PDF invoices instantly. Send quotes, accept work, and get paid — all from one place.",
  },
  {
    type: "color",
    bgColor: "#3a1600",
    accentColor: "#f59e0b",
    iconName: "bar-chart-outline",
    iconColor: "#fcd34d",
    title: "Know Your Numbers",
    body: "Live dashboards show revenue, outstanding payments, and unbilled work at a glance. Your finances, finally clear.",
  },
  {
    type: "color",
    bgColor: "#200a40",
    accentColor: "#a855f7",
    iconName: "people-outline",
    iconColor: "#d8b4fe",
    title: "Built for Freelancers",
    body: "Manage clients, tasks, expenses and your whole team. Everything designed for the way you actually work — on the go.",
  },
];

interface Props {
  onDismiss: () => void;
}

export function WelcomeOverlay({ onDismiss }: Props) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pageFade = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(0.88)).current;
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const topPad = Platform.OS === "web" ? 24 : insets.top + 12;
  const botPad = Platform.OS === "web" ? 44 : insets.bottom + 24;

  useEffect(() => {
    Animated.spring(btnScale, {
      toValue: 1,
      delay: 400,
      tension: 120,
      friction: 7,
      useNativeDriver: ND,
    }).start();
  }, []);

  useEffect(() => {
    btnScale.setValue(0.88);
    Animated.spring(btnScale, {
      toValue: 1,
      delay: 200,
      tension: 120,
      friction: 7,
      useNativeDriver: ND,
    }).start();
  }, [current]);

  const dismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 450,
      useNativeDriver: ND,
    }).start(() => {
      setVisible(false);
      onDismiss();
    });
  };

  const goNext = () => {
    if (current === PAGES.length - 1) {
      dismiss();
      return;
    }
    Animated.timing(pageFade, {
      toValue: 0,
      duration: 180,
      useNativeDriver: ND,
    }).start(() => {
      setCurrent((p) => p + 1);
      Animated.timing(pageFade, {
        toValue: 1,
        duration: 280,
        useNativeDriver: ND,
      }).start();
    });
  };

  const page = PAGES[current];
  const isLast = current === PAGES.length - 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[styles.root, { width: W, height: H, opacity: fadeAnim }]}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pageFade }]}>

          {/* ── Background ── */}
          {page.type === "image" ? (
            <>
              <Image
                source={require("../assets/images/splash_hero.png")}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <View style={styles.imgGradient} />
            </>
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: page.bgColor }]}>
              <View style={[styles.blob1, { backgroundColor: page.accentColor + "28" }]} />
              <View style={[styles.blob2, { backgroundColor: page.accentColor + "14" }]} />
            </View>
          )}

          {/* ── Skip ── */}
          {!isLast && (
            <TouchableOpacity
              style={[styles.skipBtn, { top: topPad }]}
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}

          {/* ── Large icon (colour pages only) ── */}
          {page.type === "color" && (
            <View style={styles.iconWrap}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: page.accentColor + "22",
                    borderColor: page.accentColor + "55",
                  },
                ]}
              >
                <Ionicons name={page.iconName} size={64} color={page.iconColor} />
              </View>
            </View>
          )}

          {/* ── Bottom text + CTA ── */}
          <View style={[styles.bottom, { paddingBottom: botPad }]}>
            {/* Page dots */}
            <View style={styles.dots}>
              {PAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === current ? "#ffffff" : "rgba(255,255,255,0.30)",
                      width: i === current ? 26 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            <Text style={styles.title}>{page.title}</Text>
            <Text style={styles.body}>
              {page.type === "image" ? page.subtitle : page.body}
            </Text>

            <Animated.View style={{ transform: [{ scale: btnScale }], width: "100%" }}>
              <TouchableOpacity
                style={[
                  styles.nextBtn,
                  page.type === "color"
                    ? { backgroundColor: page.accentColor }
                    : { backgroundColor: "#ffffff" },
                ]}
                onPress={goNext}
                activeOpacity={0.82}
                testID={isLast ? "welcome-get-started" : `welcome-next-${current}`}
              >
                <Text
                  style={[
                    styles.nextText,
                    { color: page.type === "color" ? "#fff" : "#1a1a2e" },
                  ]}
                >
                  {isLast ? "Get Started" : "Next"}
                </Text>
                <Ionicons
                  name={isLast ? "checkmark" : "arrow-forward"}
                  size={18}
                  color={page.type === "color" ? "#fff" : "#1a1a2e"}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  imgGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 340,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  blob1: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  blob2: {
    position: "absolute",
    bottom: -60,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  skipBtn: {
    position: "absolute",
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    zIndex: 10,
  },
  skipText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  iconWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 310,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 10,
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.80)",
    lineHeight: 23,
    marginBottom: 26,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  nextText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
