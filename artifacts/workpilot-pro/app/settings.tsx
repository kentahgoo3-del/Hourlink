import { AppIcon } from "@/components/AppIcon";
import * as FileSystem from "expo-file-system";
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
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormField";
import { useApp } from "@/context/AppContext";
import { useTheme } from "@/context/ThemeContext";
import { useWelcome } from "@/context/WelcomeContext";
import { useColors } from "@/hooks/useColors";
import { THEMES, type ThemeName } from "@/constants/themes";

const CURRENCIES = ["R", "$", "€", "£", "¥", "A$", "C$", "CHF", "NZD", "AED"];

const ACCENT_COLORS: { label: string; value: string | null }[] = [
  { label: "Theme", value: null },
  { label: "Red", value: "#ef4444" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Orange", value: "#f97316" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Lime", value: "#65a30d" },
  { label: "Green", value: "#22c55e" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Sky", value: "#0ea5e9" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Slate", value: "#475569" },
  { label: "Black", value: "#111111" },
];

type Section = "profile" | "company" | "theme" | "look" | "billing";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, companyProfile, updateSettings, updateCompanyProfile } = useApp();
  const { themeName, setTheme, appearance, setAppearance } = useTheme();
  const { triggerWelcome, triggerTour } = useWelcome();
  const [section, setSection] = useState<Section>("profile");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const themeNames = Object.keys(THEMES) as ThemeName[];

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission required", "Please allow photo access to upload a logo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 1], quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        const ext = (asset.uri.split(".").pop()?.split("?")[0] || "jpg").toLowerCase();
        const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
        const mime = mimeMap[ext] || "image/jpeg";
        updateCompanyProfile({ logoUri: `data:${mime};base64,${asset.base64}` } as any);
      } else {
        try {
          const ext = (asset.uri.split(".").pop()?.split("?")[0] || "jpg").toLowerCase();
          const destUri = `${FileSystem.documentDirectory}company_logo.${ext}`;
          await FileSystem.copyAsync({ from: asset.uri, to: destUri });
          updateCompanyProfile({ logoUri: destUri } as any);
        } catch {
          updateCompanyProfile({ logoUri: asset.uri } as any);
        }
      }
    }
  };

  const sectionLabels: Record<Section, string> = {
    profile: "Profile", company: "Company", theme: "Themes", look: "Look", billing: "Billing",
  };

  function SegmentControl({
    label, options, value, onChange,
  }: { label: string; options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[styles.segmentRow, { backgroundColor: colors.muted, borderRadius: colors.cr }]}>
          {options.map((opt) => {
            const active = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.segmentBtn,
                  { borderRadius: colors.cr - 2 },
                  active && { backgroundColor: colors.primary },
                ]}
                onPress={() => onChange(opt.value)}
              >
                <Text style={[
                  styles.segmentLabel,
                  { color: active ? "#fff" : colors.mutedForeground },
                  active && { fontFamily: "Inter_600SemiBold" },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="settings-back">
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.sectionBar, { borderBottomColor: colors.border }]}>
        {(["profile", "company", "theme", "look", "billing"] as Section[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sectionTab, section === s && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSection(s)}
          >
            <Text style={[styles.sectionTabLabel, { color: section === s ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
              {sectionLabels[s]}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.sectionTab, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }]}
          onPress={() => router.push("/team")}
        >
          <AppIcon name="people-outline" size={13} color={colors.primary} />
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
            <FormField label="Timer Alert (hours)" placeholder="2" value={(settings.timerAlertThresholdHours ?? 2).toString()} onChangeText={(v) => updateSettings({ timerAlertThresholdHours: parseFloat(v) || 2 })} keyboardType="decimal-pad" hint="Show a warning banner when a timer runs longer than this many hours." />

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 28 }]}>Help & Info</Text>

            <TouchableOpacity
              style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}
              onPress={triggerWelcome}
            >
              <View style={[styles.linkIcon, { backgroundColor: "#2dd4bf18" }]}>
                <AppIcon name="rocket-outline" size={20} color="#2dd4bf" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>Onboarding Walkthrough</Text>
                <Text style={[styles.linkHint, { color: colors.mutedForeground }]}>Replay the welcome slides</Text>
              </View>
              <AppIcon name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}
              onPress={triggerTour}
            >
              <View style={[styles.linkIcon, { backgroundColor: "#6366f118" }]}>
                <AppIcon name="compass-outline" size={20} color="#6366f1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>Guided Tour</Text>
                <Text style={[styles.linkHint, { color: colors.mutedForeground }]}>Step-by-step feature walkthrough</Text>
              </View>
              <AppIcon name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}
              onPress={() => router.push("/about")}
            >
              <View style={[styles.linkIcon, { backgroundColor: "#3b82f618" }]}>
                <AppIcon name="information-circle-outline" size={20} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>About HourLink</Text>
                <Text style={[styles.linkHint, { color: colors.mutedForeground }]}>App info, features, and version</Text>
              </View>
              <AppIcon name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}
              onPress={() => router.push("/privacy")}
            >
              <View style={[styles.linkIcon, { backgroundColor: "#22c55e18" }]}>
                <AppIcon name="shield-outline" size={20} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.foreground }]}>Privacy Policy</Text>
                <Text style={[styles.linkHint, { color: colors.mutedForeground }]}>How your data is handled</Text>
              </View>
              <AppIcon name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
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
                  <AppIcon name="image-outline" size={28} color={colors.mutedForeground} />
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
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Color Theme</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Pick a base theme. The app adapts to your device's light or dark mode automatically.</Text>
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
                          <AppIcon name="checkmark" size={12} color="#fff" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* LOOK */}
        {section === "look" && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Appearance</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Customise how the app looks and feels. Changes apply across the entire app instantly.</Text>

            {/* Accent Color */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Accent Color</Text>
            <Text style={[styles.sublabel, { color: colors.mutedForeground }]}>Override the theme's primary color with your own. Select "Theme" to use the default.</Text>
            <View style={styles.accentGrid}>
              {ACCENT_COLORS.map((ac) => {
                const isActive = appearance.accentColor === ac.value;
                const displayColor = ac.value ?? colors.primary;
                return (
                  <TouchableOpacity
                    key={ac.label}
                    style={[
                      styles.accentSwatch,
                      { backgroundColor: displayColor, borderRadius: colors.cr / 1.5 },
                      isActive && styles.accentSwatchActive,
                    ]}
                    onPress={() => setAppearance({ accentColor: ac.value })}
                  >
                    {isActive && <AppIcon name="checkmark" size={18} color="#fff" />}
                    {!isActive && ac.value === null && (
                      <Text style={{ fontSize: 8, color: "#fff", fontFamily: "Inter_600SemiBold", textAlign: "center", lineHeight: 10 }}>AUTO</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 24 }} />

            {/* Font Size */}
            <SegmentControl
              label="Font Size"
              options={[
                { label: "Small", value: "small" },
                { label: "Medium", value: "medium" },
                { label: "Large", value: "large" },
              ]}
              value={appearance.fontSize}
              onChange={(v) => setAppearance({ fontSize: v as any })}
            />

            {/* Font Size Preview */}
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr }]}>
              <Text style={{ fontSize: Math.round(11 * colors.fs), color: colors.mutedForeground, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>PREVIEW LABEL</Text>
              <Text style={{ fontSize: Math.round(22 * colors.fs), color: colors.foreground, fontFamily: "Inter_700Bold", marginBottom: 2 }}>R 12,450</Text>
              <Text style={{ fontSize: Math.round(13 * colors.fs), color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>This is how body text looks at this size.</Text>
            </View>

            <View style={{ height: 16 }} />

            {/* Card Density */}
            <SegmentControl
              label="Card Density"
              options={[
                { label: "Compact", value: "compact" },
                { label: "Normal", value: "normal" },
                { label: "Spacious", value: "spacious" },
              ]}
              value={appearance.density}
              onChange={(v) => setAppearance({ density: v as any })}
            />

            {/* Density Preview */}
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.cr, padding: Math.round(16 * colors.sp) }]}>
              <Text style={{ fontSize: Math.round(13 * colors.fs), color: colors.foreground, fontFamily: "Inter_600SemiBold", marginBottom: Math.round(4 * colors.sp) }}>Card Density Preview</Text>
              <Text style={{ fontSize: Math.round(12 * colors.fs), color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>This is how card padding feels at this density setting.</Text>
            </View>

            <View style={{ height: 16 }} />

            {/* Corner Radius */}
            <SegmentControl
              label="Corner Radius"
              options={[
                { label: "Sharp", value: "sharp" },
                { label: "Rounded", value: "rounded" },
                { label: "Pill", value: "pill" },
              ]}
              value={appearance.cornerRadius}
              onChange={(v) => setAppearance({ cornerRadius: v as any })}
            />

            {/* Radius Preview */}
            <View style={styles.radiusPreviewRow}>
              {[5, 14, 28].map((r, i) => (
                <View
                  key={r}
                  style={[
                    styles.radiusPreviewBox,
                    {
                      borderRadius: r,
                      backgroundColor: colors.primary + (colors.cr === r ? "ff" : "33"),
                      borderColor: colors.primary,
                      borderWidth: colors.cr === r ? 2 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: colors.cr === r ? "#fff" : colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                    {["Sharp", "Rounded", "Pill"][i]}
                  </Text>
                </View>
              ))}
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
              onPress={() => setShowClearConfirm(true)}
            >
              <AppIcon name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.dangerBtnText}>Clear All Data</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      <ConfirmDialog
        visible={showClearConfirm}
        title="Clear All Data"
        message="This will permanently delete all your clients, invoices, quotes, and time entries. This cannot be undone."
        confirmLabel="Delete Everything"
        destructive
        onConfirm={() => { setShowClearConfirm(false); }}
        onCancel={() => setShowClearConfirm(false)}
      />
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
  sectionTabLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16, lineHeight: 18 },
  sublabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12, lineHeight: 17 },
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
  accentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  accentSwatch: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  accentSwatchActive: { transform: [{ scale: 1.15 }], shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  segmentRow: { flexDirection: "row", padding: 3, gap: 3 },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: "center" },
  segmentLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  previewCard: { borderWidth: 1, padding: 16 },
  radiusPreviewRow: { flexDirection: "row", gap: 12 },
  radiusPreviewBox: { flex: 1, height: 48, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  linkTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  linkHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
