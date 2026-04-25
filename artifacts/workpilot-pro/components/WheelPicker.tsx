import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

const ITEM_H = 52;
const VISIBLE = 5;

type Props = {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  colors: {
    foreground: string;
    mutedForeground: string;
    muted: string;
    border: string;
    primary: string;
  };
};

export function WheelPicker({ value, min, max, onChange, label, colors }: Props) {
  const count = max - min + 1;
  const currentRef = useRef(value);
  const startValueRef = useRef(value);

  currentRef.current = value;

  const wrap = (v: number) => {
    let r = ((v - min) % count);
    if (r < 0) r += count;
    return r + min;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValueRef.current = currentRef.current;
      },
      onPanResponderMove: (_, { dy }) => {
        const steps = Math.round(-dy / ITEM_H);
        const next = wrap(startValueRef.current + steps);
        if (next !== currentRef.current) {
          onChange(next);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  const items = Array.from({ length: VISIBLE }, (_, i) => {
    const offset = i - Math.floor(VISIBLE / 2);
    return { offset, val: wrap(value + offset) };
  });

  return (
    <View style={styles.column}>
      {label ? (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      ) : null}

      <View
        style={[styles.wheel, { borderColor: colors.border, backgroundColor: colors.muted }]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.highlight,
            { borderColor: colors.primary, backgroundColor: colors.primary + "18" },
          ]}
          pointerEvents="none"
        />

        {items.map(({ offset, val }) => {
          const isCenter = offset === 0;
          const absOff = Math.abs(offset);
          const opacity = absOff === 0 ? 1 : absOff === 1 ? 0.45 : 0.18;
          return (
            <View key={offset} style={[styles.item, { height: ITEM_H }]}>
              <Text
                style={[
                  styles.digit,
                  {
                    color: isCenter ? colors.foreground : colors.mutedForeground,
                    opacity,
                    fontSize: isCenter ? 36 : absOff === 1 ? 22 : 16,
                    fontFamily: isCenter ? "Inter_700Bold" : "Inter_400Regular",
                  },
                ]}
              >
                {String(val).padStart(2, "0")}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        slide ↑↓
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  wheel: {
    width: 90,
    height: ITEM_H * 5,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  highlight: {
    position: "absolute",
    top: ITEM_H * 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
  },
  item: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    textAlign: "center",
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    opacity: 0.6,
  },
});
