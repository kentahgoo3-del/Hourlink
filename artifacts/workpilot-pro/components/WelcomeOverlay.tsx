import { AppIcon } from "@/components/AppIcon";
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

type Page = {
  bgTop: string;
  bgBottom: string;
  iconName: string;
  iconColor: string;
  iconBg: string;
  badge?: string;
  title: string;
  body: string;
  btnColor: string;
  btnTextColor: string;
  isHero?: boolean;
  heroImage?: ReturnType<typeof require>;
};

const PAGES: Page[] = [
  {
    heroImage: require("../assets/images/hourlink_hero_compressed.jpg"),
    bgTop: "#0a1628",
    bgBottom: "#0d2137",
    iconName: "briefcase",
    iconColor: "#2dd4bf",
    iconBg: "rgba(45,212,191,0.15)",
    title: "",
    body: "",
    btnColor: "#14b8a6",
    btnTextColor: "#fff",
  },
  {
    bgTop: "#042f2e",
    bgBottom: "#0c4040",
    iconName: "timer",
    iconColor: "#2dd4bf",
    iconBg: "rgba(45,212,191,0.15)",
    badge: "Time Tracking",
    title: "Never Miss a\nBillable Minute",
    body: "Start a timer with one tap — assign it to a client, set your hourly rate, and mark it billable. HourLink logs every second automatically, even in the background.",
    btnColor: "#14b8a6",
    btnTextColor: "#fff",
  },
  {
    bgTop: "#1e1b4b",
    bgBottom: "#312e81",
    iconName: "document-text",
    iconColor: "#a5b4fc",
    iconBg: "rgba(165,180,252,0.15)",
    badge: "Invoicing & Quotes",
    title: "Quote, Invoice,\nGet Paid",
    body: "Turn tracked hours into professional PDF invoices in seconds. Send quotes first, convert them on approval, and link time entries directly — no double entry ever.",
    btnColor: "#6366f1",
    btnTextColor: "#fff",
  },
  {
    bgTop: "#431407",
    bgBottom: "#7c2d12",
    iconName: "bar-chart",
    iconColor: "#fbbf24",
    iconBg: "rgba(251,191,36,0.15)",
    badge: "Financial Dashboard",
    title: "Know Exactly\nWhere You Stand",
    body: "Live revenue charts, outstanding invoice totals, and unbilled work alerts. Set a monthly income goal and watch your progress update in real-time as you work.",
    btnColor: "#f59e0b",
    btnTextColor: "#fff",
  },
  {
    bgTop: "#2e1065",
    bgBottom: "#4c1d95",
    iconName: "rocket",
    iconColor: "#c084fc",
    iconBg: "rgba(192,132,252,0.15)",
    badge: "All-in-One",
    title: "Everything a\nFreelancer Needs",
    body: "Manage clients, track expenses, create tasks, collaborate with your team, and customise the app with your own branding. You run the business — HourLink handles the admin.",
    btnColor: "#a855f7",
    btnTextColor: "#fff",
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
  const iconScale = useRef(new Animated.Value(0.7)).current;
  const btnScale = useRef(new Animated.Value(0.88)).current;
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const topPad = Math.max(insets.top, 20);
  const botPad = Math.max(insets.bottom, 28);

  const animateIn = () => {
    iconScale.setValue(0.7);
    btnScale.setValue(0.88);
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 90,
        friction: 7,
        useNativeDriver: ND,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        delay: 200,
        tension: 120,
        friction: 7,
        useNativeDriver: ND,
      }),
    ]).start();
  };

  useEffect(() => {
    animateIn();
  }, []);

  useEffect(() => {
    animateIn();
  }, [current]);

  const dismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 380,
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
      duration: 160,
      useNativeDriver: ND,
    }).start(() => {
      setCurrent((p) => p + 1);
      Animated.timing(pageFade, {
        toValue: 1,
        duration: 240,
        useNativeDriver: ND,
      }).start();
    });
  };

  const page = PAGES[current];
  const isLast = current === PAGES.length - 1;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <Animated.View style={[{ width: W, height: H, opacity: fadeAnim }]}>

        {/* ── Page background ── */}
        {page.heroImage ? (
          <>
            {/* Light background behind the contained image */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#f0f4f8" }]} />
            {/* Contained hero image — sized to fit the screen width */}
            <Image
              source={page.heroImage}
              style={{ width: W, height: H * 0.82 }}
              resizeMode="contain"
            />
            {/* Gradient fade from image into the button area */}
            <View style={styles.heroGradient} />
          </>
        ) : (
          <>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: page.bgTop }]} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: page.bgBottom, top: H * 0.45 }]} />
            <View style={[styles.blob1, { backgroundColor: page.iconColor + "18", top: H * 0.05, right: -60 }]} />
            <View style={[styles.blob2, { backgroundColor: page.iconColor + "10", bottom: H * 0.18, left: -80 }]} />
          </>
        )}

        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: pageFade }]}>
          {/* ── Skip ── */}
          {!isLast && (
            <TouchableOpacity
              style={[styles.skipBtn, { top: topPad + 8 }]}
              onPress={dismiss}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.skipText, page.heroImage && { color: "#334155" }]}>Skip</Text>
            </TouchableOpacity>
          )}

          {/* ── Central illustration (feature pages only) ── */}
          {!page.heroImage && (
            <View style={[styles.illustrationArea, { paddingTop: topPad + 60 }]}>
              {page.badge && (
                <View style={[styles.badge, { borderColor: page.iconColor + "55", backgroundColor: page.iconColor + "18" }]}>
                  <Text style={[styles.badgeText, { color: page.iconColor }]}>{page.badge}</Text>
                </View>
              )}
              <Animated.View
                style={[
                  styles.iconOuter,
                  { backgroundColor: page.iconBg, borderColor: page.iconColor + "40", transform: [{ scale: iconScale }] },
                ]}
              >
                <View style={[styles.iconInner, { backgroundColor: page.iconColor + "20" }]}>
                  <AppIcon name={page.iconName} size={60} color={page.iconColor} />
                </View>
              </Animated.View>
            </View>
          )}

          {/* ── Bottom card ── */}
          <View style={[styles.bottomCard, { paddingBottom: botPad }, page.heroImage && styles.bottomCardHero]}>
            {/* Dots */}
            <View style={styles.dots}>
              {PAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: i === current ? (page.heroImage ? "#14b8a6" : page.iconColor) : (page.heroImage ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.25)"),
                      width: i === current ? 28 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            {!!page.title && <Text style={styles.title}>{page.title}</Text>}
            {!!page.body && <Text style={styles.body}>{page.body}</Text>}

            <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: page.btnColor }]}
                onPress={goNext}
                activeOpacity={0.82}
                testID={isLast ? "welcome-get-started" : `welcome-next-${current}`}
              >
                <Text style={[styles.nextText, { color: page.btnTextColor }]}>
                  {isLast ? "Get Started" : "Next"}
                </Text>
                <AppIcon
                  name={isLast ? "rocket-outline" : "chevron-forward"}
                  size={18}
                  color={page.btnTextColor}
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
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "#f0f4f8",
    opacity: 0.92,
  },
  bottomCardHero: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f0f4f8",
  },
  blob1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  blob2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  skipBtn: {
    position: "absolute",
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    zIndex: 10,
  },
  skipText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  illustrationArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  iconOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 118,
    height: 118,
    borderRadius: 59,
    alignItems: "center",
    justifyContent: "center",
  },
  heroChips: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  heroChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bottomCard: {
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 22,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 12,
    lineHeight: 38,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 24,
    marginBottom: 28,
  },
  btnWrap: {
    width: "100%",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  nextText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
});
