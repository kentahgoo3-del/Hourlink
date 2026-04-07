import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
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
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { THEMES, type ThemeName } from "@/constants/themes";

const CURRENCIES = ["R", "$", "€", "£", "¥", "A$", "C$", "CHF", "NZD", "AED"];

type Section = "profile" | "company" | "theme" | "billing";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, companyProfile, updateSettings, updateCompanyProfile } = useApp();
  const { themeName, setTheme } = useTheme();
  const [section, setSection] = useState<Section>("profile");

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const themeNames = Object.keys(THEMES) as ThemeName[];

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission required", "Please allow photo access to upload a logo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      updateCompanyProfile({ logoUri: result.assets[0].uri } as any);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="settings-back">
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.sectionBar, { borderBottomColor: colors.border }]}>
        {(["profile", "company", "theme", "billing"] as Section[]).map((s) => {
          const labels: Record<Section, string> = { profile: "Profile", company: "Company", theme: "Theme", billing: "Billing" };
          return (
            <TouchableOpacity
              key={s}
              style={[styles.sectionTab, section === s && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.sectionTabLabel, { color: section === s ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>{labels[s]}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.sectionTab, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }]}
          onPress={() => router.push("/team")}
        >
          <Ionicons name="people-outline" size={13} color={colors.primary} />
          <Text style={[styles.sectionTabLabel, { color: colors.primary }]} numberOfLines={1}>Team</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 40 }} showsVerticalScrollIndicator={false}>

        {/* PROFILE */}
        {section === "profile" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your Profile</Text>
            <FormField label="Full Name" placeholder="Your name" value={settings.name} onChangeText={(v) => updateSettings({ name: v })} />
            <FormField label="Email" placeholder="you@example.com" value={settings.email} onChangeText={(v) => updateSettings({ email: v })} keyboardType="email-address" />
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Defaults</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Currency</Text>
            <View style={styles.currencyRow}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.currencyChip, { backgroundColor: settings.currency === c ? colors.primary : colors.muted }]}
                  onPress={() => updateSettings({ currency: c })}
                >
                  <Text style={[styles.currencyLabel, { color: settings.currency === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FormField label="Default Hourly Rate" prefix={settings.currency} placeholder="500" value={settings.defaultHourlyRate.toString()} onChangeText={(v) => updateSettings({ defaultHourlyRate: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
            <FormField label="Default Tax %" placeholder="15" value={settings.defaultTaxPercent.toString()} onChangeText={(v) => updateSettings({ defaultTaxPercent: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
            <FormField label="Monthly Income Goal" prefix={settings.currency} placeholder="50000" value={settings.profitGoal.toString()} onChangeText={(v) => updateSettings({ profitGoal: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
            <FormField label="Unbilled Alert (days)" placeholder="7" value={settings.billingReminderDays.toString()} onChangeText={(v) => updateSettings({ billingReminderDays: parseInt(v) || 7 })} keyboardType="number-pad" />
          </>
        )}

        {/* COMPANY */}
        {section === "company" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Company Branding</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Appears on all your invoices and quotes.</Text>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Company Logo</Text>
            <TouchableOpacity style={[styles.logoBox, { borderColor: colors.border, backgroundColor: colors.muted }]} onPress={pickLogo} testID="pick-logo">
              {(companyProfile as any).logoUri ? (
                <Image source={{ uri: (companyProfile as any).logoUri }} style={styles.logoImg} resizeMode="contain" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.logoPlaceholderText, { color: colors.mutedForeground }]}>Tap to upload logo</Text>
                </View>
              )}
            </TouchableOpacity>

            <FormField label="Company Name" placeholder="Acme Pty Ltd" value={companyProfile.name} onChangeText={(v) => updateCompanyProfile({ name: v })} />
            <FormField label="Tagline" placeholder="Delivering excellence since 2010" value={companyProfile.tagline} onChangeText={(v) => updateCompanyProfile({ tagline: v })} />
            <FormField label="Phone" placeholder="+27 12 345 6789" value={companyProfile.phone} onChangeText={(v) => updateCompanyProfile({ phone: v })} keyboardType="phone-pad" />
            <FormField label="Email" placeholder="billing@company.com" value={companyProfile.email} onChangeText={(v) => updateCompanyProfile({ email: v })} keyboardType="email-address" />
            <FormField label="Website" placeholder="www.company.com" value={companyProfile.website} onChangeText={(v) => updateCompanyProfile({ website: v })} />
            <FormField label="VAT / Tax Number" placeholder="4170000000" value={companyProfile.vatNumber} onChangeText={(v) => updateCompanyProfile({ vatNumber: v })} />

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Address</Text>
            <FormField label="Street Address" placeholder="123 Main Street" value={companyProfile.addressLine1} onChangeText={(v) => updateCompanyProfile({ addressLine1: v })} />
            <FormField label="Address Line 2" placeholder="Suite 100 (optional)" value={companyProfile.addressLine2} onChangeText={(v) => updateCompanyProfile({ addressLine2: v })} />
            <FormField label="City" placeholder="Cape Town" value={companyProfile.city} onChangeText={(v) => updateCompanyProfile({ city: v })} />
            <FormField label="Province / State" placeholder="Western Cape" value={companyProfile.province} onChangeText={(v) => updateCompanyProfile({ province: v })} />
            <FormField label="Country" placeholder="South Africa" value={companyProfile.country} onChangeText={(v) => updateCompanyProfile({ country: v })} />
            <FormField label="Postal Code" placeholder="8001" value={companyProfile.postalCode} onChangeText={(v) => updateCompanyProfile({ postalCode: v })} />

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Banking Details</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Shown on invoices so clients know where to pay.</Text>
            <FormField label="Bank Name" placeholder="First National Bank" value={companyProfile.bankName} onChangeText={(v) => updateCompanyProfile({ bankName: v })} />
            <FormField label="Account Number" placeholder="62000000000" value={companyProfile.bankAccount} onChangeText={(v) => updateCompanyProfile({ bankAccount: v })} />
            <FormField label="Branch Code" placeholder="250655" value={companyProfile.bankBranch} onChangeText={(v) => updateCompanyProfile({ bankBranch: v })} />

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Payment Terms</Text>
            <FormField label="Default Terms Text" placeholder="Payment due within 30 days of invoice date." value={companyProfile.paymentTerms} onChangeText={(v) => updateCompanyProfile({ paymentTerms: v })} multiline numberOfLines={3} />
          </>
        )}

        {/* THEME */}
        {section === "theme" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>App Theme</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Pick a color theme. The app adapts to your device's light or dark mode setting automatically.</Text>
            <View style={styles.themeGrid}>
              {themeNames.map((name) => {
                const theme = THEMES[name];
                const isActive = themeName === name;
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.themeCard, { backgroundColor: colors.card, borderColor: isActive ? theme.light.primary : colors.border, borderWidth: isActive ? 2 : 1 }]}
                    onPress={() => setTheme(name)}
                    testID={`theme-${name}`}
                  >
                    <View style={styles.swatchRow}>
                      <View style={[styles.swatch, { backgroundColor: theme.light.primary, flex: 3 }]} />
                      <View style={[styles.swatch, { backgroundColor: theme.light.accent, flex: 1 }]} />
                      <View style={[styles.swatch, { backgroundColor: theme.dark.card, flex: 1 }]} />
                    </View>
                    <View style={styles.themeCardBody}>
                      <Text style={styles.themeEmoji}>{theme.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeName, { color: colors.foreground }]}>{theme.label}</Text>
                        {isActive && <Text style={[styles.themeActiveTxt, { color: theme.light.primary }]}>Active</Text>}
                      </View>
                      {isActive && (
                        <View style={[styles.themeCheck, { backgroundColor: theme.light.primary }]}>
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* BILLING */}
        {section === "billing" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Billing Preferences</Text>
            <FormField label="Billing Reminder — Alert when client has unbilled hours older than N days" placeholder="7" value={settings.billingReminderDays.toString()} onChangeText={(v) => updateSettings({ billingReminderDays: parseInt(v) || 7 })} keyboardType="number-pad" />
            <FormField label="Monthly Income Goal" prefix={settings.currency} placeholder="50000" value={settings.profitGoal.toString()} onChangeText={(v) => updateSettings({ profitGoal: parseFloat(v) || 0 })} keyboardType="decimal-pad" />
            <TouchableOpacity
              style={[styles.dangerBtn, { borderColor: "#ef4444" }]}
              onPress={() => Alert.alert("Clear All Data", "This will permanently delete all your clients, invoices, quotes, and time entries.", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete Everything", style: "destructive", onPress: () => {} },
              ])}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.dangerBtnText}>Clear All Data</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  sectionBar: { borderBottomWidth: 1, flexDirection: "row" },
  sectionTab: { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  sectionTabLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8, letterSpacing: 0.3 },
  currencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  currencyChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  currencyLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  logoBox: { borderRadius: 12, borderWidth: 1, borderStyle: "dashed", height: 80, marginBottom: 16, overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  logoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  logoPlaceholderText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  themeCard: { width: "47%", borderRadius: 14, overflow: "hidden" },
  swatchRow: { flexDirection: "row", height: 44 },
  swatch: { height: 44 },
  themeCardBody: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  themeEmoji: { fontSize: 20 },
  themeName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  themeActiveTxt: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  themeCheck: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dangerBtn: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 14, marginTop: 24 },
  dangerBtnText: { color: "#ef4444", fontSize: 15, fontFamily: "Inter_500Medium" },
});
