import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const nativeDriver = Platform.OS !== "web";

interface Props {
  onDismiss: () => void;
}

export function WelcomeOverlay({ onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const dismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 450,
      useNativeDriver: nativeDriver,
    }).start(onDismiss);
  };

  useEffect(() => {
    Animated.spring(btnScale, {
      toValue: 1,
      delay: 600,
      tension: 100,
      friction: 8,
      useNativeDriver: nativeDriver,
    }).start();

    const timer = setTimeout(dismiss, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.container, { opacity: fadeAnim }]}
    >
      <Image
        source={require("../assets/images/splash_hero.png")}
        style={styles.image}
        resizeMode="cover"
      />

      <View style={styles.gradient} />

      <View
        style={[
          styles.bottomArea,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 24 },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={styles.btn}
            onPress={dismiss}
            activeOpacity={0.85}
            testID="welcome-get-started"
          >
            <Text style={styles.btnText}>Get Started</Text>
            <Text style={styles.btnArrow}>→</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.hint}>Tap anywhere to continue</Text>
      </View>

      {/* Tapping anywhere also dismisses */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={dismiss}
        activeOpacity={1}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 9999,
    elevation: 9999,
  },
  image: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
    zIndex: 2,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  btnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1a1a2e",
    letterSpacing: 0.2,
  },
  btnArrow: {
    fontSize: 18,
    color: "#1a1a2e",
    fontFamily: "Inter_700Bold",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
});
