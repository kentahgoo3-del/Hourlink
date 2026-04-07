import { AppIcon } from "@/components/AppIcon";
import React, { useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Client {
  id: string;
  name: string;
  company?: string;
  color: string;
}

interface ClientDropdownProps {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  label?: string;
}

export function ClientDropdown({
  clients,
  value,
  onChange,
  placeholder = "Select client",
  allowNone = false,
  noneLabel = "No client",
  label,
}: ClientDropdownProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);
  const [triggerY, setTriggerY] = useState(0);
  const [triggerX, setTriggerX] = useState(0);
  const [triggerW, setTriggerW] = useState(0);

  const selected = clients.find((c) => c.id === value);

  const displayLabel = selected
    ? selected.company
      ? `${selected.name} — ${selected.company}`
      : selected.name
    : allowNone && !value
    ? noneLabel
    : placeholder;

  const handleOpen = () => {
    triggerRef.current?.measureInWindow((x, y, w, _h) => {
      setTriggerX(x);
      setTriggerY(y + _h + 4);
      setTriggerW(w);
      setOpen(true);
    });
  };

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      {label && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      )}
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          style={[styles.trigger, { backgroundColor: colors.muted, borderColor: selected ? selected.color : colors.border }]}
          onPress={handleOpen}
          activeOpacity={0.7}
        >
          <View style={styles.triggerLeft}>
            {selected && (
              <View style={[styles.dot, { backgroundColor: selected.color }]} />
            )}
            <Text
              style={[styles.triggerText, { color: selected ? colors.foreground : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {displayLabel}
            </Text>
          </View>
          <AppIcon name="chevron-down" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View
          style={[
            styles.menu,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              top: triggerY,
              left: triggerX,
              width: triggerW,
            },
          ]}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
            {allowNone && (
              <TouchableOpacity
                style={[styles.item, !value && { backgroundColor: colors.primary + "18" }]}
                onPress={() => pick("")}
              >
                <View style={[styles.dot, { backgroundColor: colors.border }]} />
                <Text style={[styles.itemText, { color: colors.foreground }]}>{noneLabel}</Text>
                {!value && <AppIcon name="checkmark" size={14} color={colors.primary} />}
              </TouchableOpacity>
            )}
            {clients.map((c) => {
              const isSelected = c.id === value;
              const label = c.company ? `${c.name} — ${c.company}` : c.name;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.item, isSelected && { backgroundColor: c.color + "18" }]}
                  onPress={() => pick(c.id)}
                >
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={[styles.itemText, { color: colors.foreground }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {isSelected && <AppIcon name="checkmark" size={14} color={c.color} />}
                </TouchableOpacity>
              );
            })}
            {clients.length === 0 && !allowNone && (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No clients yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.3 },
  trigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, marginBottom: 16,
  },
  triggerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  triggerText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  menu: {
    position: "absolute",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  itemText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  empty: { padding: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
