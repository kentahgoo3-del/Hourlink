import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import type { TimeEntry } from "@/context/AppContext";

function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  timer: TimeEntry;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
};

export function TimerWidget({ timer, onStop, onPause, onResume }: Props) {
  const colors = useColors();
  const { clients, settings } = useApp();
  const isRunning = !timer.timerPaused;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const calcElapsed = () => {
      const sessionSecs = isRunning
        ? Math.floor((Date.now() - new Date(timer.sessionStartTime || timer.startTime).getTime()) / 1000)
        : 0;
      setElapsed((timer.pausedSeconds || 0) + sessionSecs);
    };
    calcElapsed();
    if (!isRunning) return;
    const id = setInterval(calcElapsed, 1000);
    return () => clearInterval(id);
  }, [timer, isRunning]);

  const client = clients.find((c) => c.id === timer.clientId);
  const currency = client?.currency || settings.currency;
  const rate = timer.hourlyRate;
  const earned = ((elapsed / 3600) * rate).toFixed(2);

  return (
    <View
      style={[
        styles.widget,
        isRunning
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.indicator}>
          {isRunning ? (
            <>
              <View style={styles.pulse} />
              <View style={styles.dot} />
            </>
          ) : (
            <View style={[styles.pausedDot, { backgroundColor: colors.mutedForeground }]} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={[styles.timerText, { color: isRunning ? "#fff" : colors.foreground }]}>
            {fmt(elapsed)}
          </Text>
          <Text
            style={[styles.desc, { color: isRunning ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {timer.description || "Working"} · {client?.name || "No client"}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={[styles.earned, { color: isRunning ? "#fff" : colors.foreground }]}>
            {currency}{earned}
          </Text>
          <View style={styles.actions}>
            {isRunning ? (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPause(); }}
                style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.25)" }]}
                testID="pause-timer-btn"
              >
                <AppIcon name="pause" size={15} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onResume(); }}
                style={[styles.actionBtn, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55", borderWidth: 1 }]}
                testID="resume-timer-btn"
              >
                <AppIcon name="play" size={15} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onStop(); }}
              style={[styles.actionBtn, { backgroundColor: isRunning ? "rgba(255,255,255,0.25)" : colors.muted }]}
              testID="stop-timer-btn"
            >
              <AppIcon name="stop" size={15} color={isRunning ? "#fff" : colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  indicator: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  pausedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    opacity: 0.5,
  },
  info: {
    flex: 1,
  },
  timerText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  right: {
    alignItems: "flex-end",
    gap: 5,
  },
  earned: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  actions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
