import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const CURRENCIES = ["R", "$", "£", "€", "₦", "KSh", "GH₵"];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useApp();

  const [name, setName] = useState(settings.name);
  const [company, setCompany] = useState(settings.company);
  const [email, setEmail] = useState(settings.email);
  const [currency, setCurrency] = useState(settings.currency);
  const [rate, setRate] = useState(settings.defaultHourlyRate.toString());
  const [tax, setTax] = useState(settings.defaultTaxPercent.toString());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({
      name: name.trim() || settings.name,
      company: company.trim(),
      email: email.trim(),
      currency,
      defaultHourlyRate: parseFloat(rate) || settings.defaultHourlyRate,
      defaultTaxPercent: parseFloat(tax) || settings.defaultTaxPercent,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: botPadding + 40 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="settings-back">
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Profile</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <FormField label="Your Name" placeholder="Enter your name" value={name} onChangeText={setName} />
        <FormField label="Company" placeholder="Enter company name" value={company} onChangeText={setCompany} />
        <FormField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      </View>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Billing Defaults</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.currencyBtn, {
                backgroundColor: currency === c ? colors.primary : colors.muted,
                borderColor: currency === c ? colors.primary : "transparent",
              }]}
              onPress={() => setCurrency(c)}
            >
              <Text style={[styles.currencyLabel, { color: currency === c ? "#fff" : colors.foreground }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormField label="Default Hourly Rate" prefix={currency} placeholder="500" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
        <FormField label="Default Tax %" placeholder="15" value={tax} onChangeText={setTax} keyboardType="decimal-pad" />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: saved ? "#10b981" : colors.primary }]}
        onPress={handleSave}
        testID="save-settings-btn"
      >
        <Ionicons name={saved ? "checkmark" : "save-outline"} size={18} color="#fff" />
        <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Settings"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 28 },
  title: { fontSize: 20, fontFamily: "Inter_600SemiBold" },
  section: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.3 },
  currencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  currencyBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  currencyLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 32 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
