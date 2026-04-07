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
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isoToLocal(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split("T")[0].split("-");
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = parseInt(parts[2]);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m, d };
}

function formatSelected(iso: string): string {
  const local = isoToLocal(iso);
  if (!local) return iso;
  const date = new Date(local.y, local.m, local.d);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return `${MONTHS_SHORT[local.m]} ${local.d}, ${local.y}`;
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

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
    if (selected && selected.y === viewYear && selected.m === viewMonth && selected.d === d) {
      onChange(null);
    } else {
      onChange(date.toISOString());
    }
    setExpanded(false);
  };

  const isSelected = (d: number) =>
    selected !== null && selected.y === viewYear && selected.m === viewMonth && selected.d === d;

  const isToday = (d: number) =>
    todayY === viewYear && todayM === viewMonth && todayD === d;

  const isPast = (d: number) => {
    const cell = new Date(viewYear, viewMonth, d);
    return cell < new Date(todayY, todayM, todayD);
  };

  return (
    <View style={styles.wrapper}>
      {/* Collapsed trigger row */}
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.muted, borderColor: colors.border }]}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.triggerText, { color: value ? colors.foreground : colors.mutedForeground }]}>
          {value ? formatSelected(value) : "No date set"}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Expanded calendar */}
      {expanded && (
        <View style={[styles.calendar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month nav */}
          <View style={styles.nav}>
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.muted }]} onPress={prevMonth}>
              <Ionicons name="chevron-back" size={14} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.foreground }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.muted }]} onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={14} color={colors.foreground} />
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
                    sel && { backgroundColor: colors.primary, borderRadius: 16 },
                    !sel && tod && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 16 },
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

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => {
                setViewYear(todayY); setViewMonth(todayM);
                onChange(new Date(todayY, todayM, todayD).toISOString());
                setExpanded(false);
              }}
              style={styles.footerBtn}
            >
              <Text style={[styles.footerBtnText, { color: colors.primary }]}>Today</Text>
            </TouchableOpacity>
            {value && (
              <TouchableOpacity onPress={() => { onChange(null); setExpanded(false); }} style={styles.footerBtn}>
                <Text style={[styles.footerBtnText, { color: colors.mutedForeground }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  calendar: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginTop: 6 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10 },
  navBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  weekRow: { flexDirection: "row", paddingHorizontal: 6, paddingBottom: 4 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: 10, fontFamily: "Inter_500Medium" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, paddingBottom: 6 },
  cell: { width: "14.285%", height: 34, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 12, borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  footerBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  footerBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
