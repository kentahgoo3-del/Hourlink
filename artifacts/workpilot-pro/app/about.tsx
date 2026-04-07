import { AppIcon } from "@/components/AppIcon";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "1.0.0";

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const features = [
    { icon: "timer-outline", color: "#f59e0b", title: "Time Tracking", desc: "Track billable hours with one-tap timers" },
    { icon: "people-outline", color: "#8b5cf6", title: "Client Management", desc: "Organise clients, projects, and rates" },
    { icon: "document-text-outline", color: "#ec4899", title: "Invoicing & Quotes", desc: "Create professional invoices and quotes" },
    { icon: "bar-chart-outline", color: "#0ea5e9", title: "Reports & Analytics", desc: "Detailed financial and time reports" },
    { icon: "checkmark-circle-outline", color: "#22c55e", title: "Task Management", desc: "Organise work with priorities and boards" },
    { icon: "wallet-outline", color: "#f97316", title: "Expense Tracking", desc: "Log and categorise business expenses" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>About HourLink</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: botPadding + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../assets/images/hourlink_icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.foreground }]}>HourLink</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Track & earn for every hour worked</Text>
          <View style={[styles.versionBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.versionText, { color: colors.primary }]}>Version {APP_VERSION}</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>What is HourLink?</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            HourLink is a comprehensive freelancer toolkit designed to help independent professionals manage every aspect of their business. From tracking billable hours to creating invoices, managing clients, and analysing your financial performance — all in one beautifully crafted app.
          </Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground, marginTop: 8 }]}>
            Built with freelancers in mind, HourLink keeps your data private and stored locally on your device. No account required, no data harvesting — just a powerful tool that works for you.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Key Features</Text>
        {features.map((f, i) => (
          <View key={i} style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: f.color + "18" }]}>
              <AppIcon name={f.icon} size={20} color={f.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: colors.foreground }]}>{f.title}</Text>
              <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{f.desc}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 24 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Built with</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            React Native • Expo • TypeScript{"\n"}
            Designed and developed with care for the freelancer community.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Contact & Support</Text>
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Have feedback, found a bug, or need help? We'd love to hear from you.
          </Text>
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL("mailto:support@hourlink.app")}
          >
            <AppIcon name="mail-outline" size={16} color="#fff" />
            <Text style={styles.contactBtnText}>support@hourlink.app</Text>
          </TouchableOpacity>
        </View>

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
  logoSection: { alignItems: "center", marginBottom: 28 },
  logo: { width: 80, height: 80, borderRadius: 20, marginBottom: 12 },
  appName: { fontSize: 28, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 12 },
  versionBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  versionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  cardBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 12, marginTop: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  featureIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  featureDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  contactBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  contactBtnText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" },
  footer: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 28, marginBottom: 12 },
});
