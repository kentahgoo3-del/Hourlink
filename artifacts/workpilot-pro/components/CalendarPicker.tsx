import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface CalendarPickerProps {
  value: string | null;
  onChange: (iso: string | null) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function isoToLocal(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m, d };
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const colors = useColors();

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const initial = value ? isoToLocal(value) : null;
  const [viewYear, setViewYear] = useState(initial?.y ?? todayY);
  const [viewMonth, setViewMonth] = useState(initial?.m ?? todayM);

  const selected = value ? isoToLocal(value) : null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth, daysInMonth, firstDow]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (d: number) => {
    const date = new Date(viewYear, viewMonth, d);
    const iso = date.toISOString();
    if (selected && selected.y === viewYear && selected.m === viewMonth && selected.d === d) {
      onChange(null);
    } else {
      onChange(iso);
    }
  };

  const isSelected = (d: number) =>
    selected !== null && selected.y === viewYear && selected.m === viewMonth && selected.d === d;

  const isToday = (d: number) =>
    todayY === viewYear && todayM === viewMonth && todayD === d;

  const isPast = (d: number) => {
    const cell = new Date(viewYear, viewMonth, d);
    const now = new Date(todayY, todayM, todayD);
    return cell < now;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Month nav */}
      <View style={styles.nav}>
        <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.muted }]} onPress={prevMonth}>
          <Ionicons name="chevron-back" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.muted }]} onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.weekRow}>
        {DAYS.map((d) => (
          <Text key={d} style={[styles.dayHeader, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (cell === null) return <View key={`empty-${i}`} style={styles.cell} />;
          const sel = isSelected(cell);
          const tod = isToday(cell);
          const past = isPast(cell);
          return (
            <TouchableOpacity
              key={`${viewYear}-${viewMonth}-${cell}`}
              style={[
                styles.cell,
                sel && { backgroundColor: colors.primary, borderRadius: 20 },
                !sel && tod && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20 },
              ]}
              onPress={() => selectDay(cell)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dayText,
                { color: past && !sel ? colors.mutedForeground : colors.foreground },
                sel && { color: "#fff", fontFamily: "Inter_600SemiBold" },
                tod && !sel && { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}>
                {cell}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Clear / Today row */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => { setViewYear(todayY); setViewMonth(todayM); onChange(new Date(todayY, todayM, todayD).toISOString()); }}
          style={styles.footerBtn}
        >
          <Text style={[styles.footerBtnText, { color: colors.primary }]}>Today</Text>
        </TouchableOpacity>
        {value && (
          <TouchableOpacity onPress={() => onChange(null)} style={styles.footerBtn}>
            <Text style={[styles.footerBtnText, { color: colors.mutedForeground }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 16 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  navBtn: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  weekRow: { flexDirection: "row", paddingHorizontal: 8, paddingBottom: 6 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_500Medium" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 8, paddingBottom: 8 },
  cell: { width: "14.285%", aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 12, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  footerBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  footerBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
