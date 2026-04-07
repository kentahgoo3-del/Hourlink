import { AppIcon } from "@/components/AppIcon";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const LAST_UPDATED = "7 April 2026";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: `HourLink is designed with your privacy in mind. We collect and store the absolute minimum amount of data needed to provide you with a functional experience.

Local Data (stored on your device only):
• Your profile information (name, email)
• Company branding details (name, address, logo)
• Client records and contact information
• Time entries, invoices, quotes, and expenses
• App preferences and theme settings

This data never leaves your device unless you explicitly choose to share it (e.g., exporting or sharing an invoice).`,
  },
  {
    title: "2. Data Storage & Security",
    body: `All your data is stored locally on your device using secure local storage (AsyncStorage). We do not operate cloud servers that store your personal or business data.

Team Collaboration: If you use the optional team collaboration features, minimal data (team invites, shared project references) is transmitted through our API server. This data is kept to the minimum necessary for the feature to function.

We recommend keeping your device secured with a passcode or biometric lock to protect your HourLink data.`,
  },
  {
    title: "3. Data We Do NOT Collect",
    body: `We want to be transparent about what we don't do:

• We do NOT track your location
• We do NOT collect analytics or usage data
• We do NOT use advertising trackers
• We do NOT sell or share your data with third parties
• We do NOT create user profiles for marketing purposes
• We do NOT access your contacts, camera, or microphone without explicit permission`,
  },
  {
    title: "4. Third-Party Services",
    body: `HourLink may interact with third-party services only when you explicitly initiate it:

• Email: When you share an invoice or quote via email, your device's email client handles the transmission
• Image Picker: Used solely to upload your company logo, which is stored locally
• Expo: The development framework used to build the app. Expo may collect anonymous crash reports to improve stability

We do not integrate with any advertising networks or data brokers.`,
  },
  {
    title: "5. Your Rights & Data Control",
    body: `You have full control over your data:

• View: All your data is visible within the app at all times
• Export: You can export invoices and reports as needed
• Delete: Use Settings → Billing → "Clear All Data" to permanently remove all app data
• Portability: Your data is stored locally and can be backed up through your device's backup system

Since we don't store your data on external servers, there is no account to delete or data request to file.`,
  },
  {
    title: "6. Children's Privacy",
    body: "HourLink is designed for professional freelancers and business users. We do not knowingly collect information from children under 13. If you believe a child has used this app, the data exists only on the device and can be cleared through the app settings.",
  },
  {
    title: "7. Changes to This Policy",
    body: "We may update this privacy policy from time to time. Any changes will be reflected in the app with an updated \"Last Updated\" date. We encourage you to review this policy periodically.",
  },
  {
    title: "8. Contact Us",
    body: "If you have any questions or concerns about this privacy policy or HourLink's data practices, please contact us at:\n\nsupport@hourlink.app",
  },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: botPadding + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
          <AppIcon name="shield-outline" size={24} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.topCardTitle, { color: colors.foreground }]}>Your Privacy Matters</Text>
            <Text style={[styles.topCardDesc, { color: colors.mutedForeground }]}>
              HourLink stores all your data locally on your device. We don't collect, sell, or share your personal information.
            </Text>
          </View>
        </View>

        <Text style={[styles.updated, { color: colors.mutedForeground }]}>Last updated: {LAST_UPDATED}</Text>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{s.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{s.body}</Text>
          </View>
        ))}

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          © {new Date().getFullYear()} HourLink. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  topCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  topCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  topCardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  updated: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  sectionBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  footer: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 12, marginBottom: 12 },
});
