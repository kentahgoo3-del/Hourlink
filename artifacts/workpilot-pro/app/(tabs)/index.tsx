import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatCard } from "@/components/StatCard";
import { TimerWidget } from "@/components/TimerWidget";
import { ClientBadge } from "@/components/ClientBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  const h = seconds / 3600;
  return `${h.toFixed(1)}h`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, timeEntries, invoices, quotes, settings,
    getTotalRevenue, getUnbilledAmount, getOutstandingAmount,
    activeTimer,
  } = useApp();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekSeconds = useMemo(() =>
    timeEntries
      .filter((e) => e.endTime && new Date(e.startTime) >= weekStart)
      .reduce((s, e) => s + e.durationSeconds, 0),
    [timeEntries]
  );

  const monthRevenue = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return invoices
      .filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= start)
      .reduce((sum, inv) => {
        const subtotal = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + subtotal * (1 + inv.taxPercent / 100);
      }, 0);
  }, [invoices]);

  const topClients = useMemo(() => {
    return clients
      .map((c) => ({
        ...c,
        revenue: invoices
          .filter((inv) => inv.clientId === c.id && inv.status === "paid")
          .reduce((sum, inv) => {
            const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
            return sum + sub * (1 + inv.taxPercent / 100);
          }, 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [clients, invoices]);

  const recentInvoices = useMemo(() =>
    invoices.slice(0, 3),
    [invoices]
  );

  const recentQuotes = useMemo(() =>
    quotes.filter((q) => q.status === "sent" || q.status === "draft").slice(0, 2),
    [quotes]
  );

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{settings.name}</Text>
        </View>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/settings")}
          testID="settings-btn"
        >
          <Ionicons name="settings-outline" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Active Timer */}
      <TimerWidget />

      {/* KPI Row */}
      <View style={styles.kpiRow}>
        <StatCard
          label="This week"
          value={formatHours(weekSeconds)}
          sub="hours tracked"
          color={colors.primary}
        />
        <StatCard
          label="This month"
          value={formatCurrency(monthRevenue, settings.currency)}
          sub="revenue"
          color="#10b981"
        />
      </View>
      <View style={[styles.kpiRow, { marginTop: 10 }]}>
        <StatCard
          label="Unbilled"
          value={formatCurrency(getUnbilledAmount(), settings.currency)}
          sub="ready to invoice"
          color="#f59e0b"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(getOutstandingAmount(), settings.currency)}
          sub="awaiting payment"
          color="#ef4444"
        />
      </View>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/work"); }}
          testID="quick-timer"
        >
          <Ionicons name="timer-outline" size={22} color="#fff" />
          <Text style={styles.quickLabel}>New Timer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/finance"); }}
          testID="quick-invoice"
        >
          <Ionicons name="document-text-outline" size={22} color={colors.foreground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>New Invoice</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/clients"); }}
          testID="quick-client"
        >
          <Ionicons name="person-add-outline" size={22} color={colors.foreground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>Add Client</Text>
        </TouchableOpacity>
      </View>

      {/* Top Clients */}
      {topClients.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Clients</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {topClients.map((c, idx) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientRow, idx < topClients.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => router.push({ pathname: "/client/[id]", params: { id: c.id } })}
              >
                <ClientBadge name={c.name} color={c.color} />
                <View style={styles.clientInfo}>
                  <Text style={[styles.clientName, { color: colors.foreground }]}>{c.name}</Text>
                  <Text style={[styles.clientSub, { color: colors.mutedForeground }]}>{c.company}</Text>
                </View>
                <Text style={[styles.clientRevenue, { color: colors.foreground }]}>
                  {formatCurrency(c.revenue, settings.currency)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Recent Invoices</Text>
            <TouchableOpacity onPress={() => router.push("/finance")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentInvoices.map((inv, idx) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const total = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.invoiceRow, idx < recentInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}
                >
                  <View style={styles.invoiceInfo}>
                    <Text style={[styles.invoiceNum, { color: colors.foreground }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.invoiceClient, { color: colors.mutedForeground }]}>{client?.name || "Unknown"}</Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={[styles.invoiceAmount, { color: colors.foreground }]}>
                      {formatCurrency(total, settings.currency)}
                    </Text>
                    <StatusBadge status={inv.status} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Pending Quotes */}
      {recentQuotes.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pending Quotes</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentQuotes.map((q, idx) => {
              const client = clients.find((c) => c.id === q.clientId);
              const total = q.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + q.taxPercent / 100);
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.invoiceRow, idx < recentQuotes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/quote/[id]", params: { id: q.id } })}
                >
                  <View style={styles.invoiceInfo}>
                    <Text style={[styles.invoiceNum, { color: colors.foreground }]}>{q.quoteNumber}</Text>
                    <Text style={[styles.invoiceClient, { color: colors.mutedForeground }]}>{client?.name || "Unknown"}</Text>
                  </View>
                  <View style={styles.invoiceRight}>
                    <Text style={[styles.invoiceAmount, { color: colors.foreground }]}>
                      {formatCurrency(total, settings.currency)}
                    </Text>
                    <StatusBadge status={q.status} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold", marginTop: 2 },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  kpiRow: { flexDirection: "row", gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  quickRow: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#fff",
    textAlign: "center",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  clientRevenue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  invoiceInfo: { flex: 1 },
  invoiceNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  invoiceClient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  invoiceRight: { alignItems: "flex-end", gap: 4 },
  invoiceAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
