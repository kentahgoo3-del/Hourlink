import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimerWidget() {
  const colors = useColors();
  const { activeTimer, stopTimer, clients } = useApp();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) { setElapsed(0); return; }
    const update = () => {
      setElapsed(Math.floor((Date.now() - new Date(activeTimer.startTime).getTime()) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  const client = clients.find((c) => c.id === activeTimer.clientId);
  const earned = ((elapsed / 3600) * activeTimer.hourlyRate).toFixed(2);

  return (
    <View style={[styles.widget, { backgroundColor: colors.primary }]}>
      <View style={styles.row}>
        <View style={styles.pulseContainer}>
          <View style={styles.pulse} />
          <View style={styles.dot} />
        </View>
        <View style={styles.info}>
          <Text style={styles.timerText}>{formatDuration(elapsed)}</Text>
          <Text style={styles.desc} numberOfLines={1}>
            {activeTimer.description || "Working"} · {client?.name || "No client"}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.earned}>R{earned}</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              stopTimer();
            }}
            style={styles.stopBtn}
            testID="stop-timer-btn"
          >
            <AppIcon name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pulseContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  info: {
    flex: 1,
  },
  timerText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  desc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  earned: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  stopBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
