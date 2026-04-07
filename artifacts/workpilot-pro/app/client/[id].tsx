import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClientBadge } from "@/components/ClientBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, timeEntries, invoices, quotes, deleteClient, settings } = useApp();

  const client = clients.find((c) => c.id === id);
  const clientEntries = useMemo(() => timeEntries.filter((e) => e.clientId === id && e.endTime), [timeEntries, id]);
  const clientInvoices = useMemo(() => invoices.filter((inv) => inv.clientId === id), [invoices, id]);
  const clientQuotes = useMemo(() => quotes.filter((q) => q.clientId === id), [quotes, id]);

  const totalSeconds = useMemo(() => clientEntries.reduce((s, e) => s + e.durationSeconds, 0), [clientEntries]);
  const totalRevenue = useMemo(() =>
    clientInvoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0),
    [clientInvoices]
  );

  const outstanding = useMemo(() =>
    clientInvoices
      .filter((inv) => inv.status === "sent" || inv.status === "overdue")
      .reduce((sum, inv) => {
        const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
        return sum + sub * (1 + inv.taxPercent / 100);
      }, 0),
    [clientInvoices]
  );

  if (!client) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Client not found</Text>
      </View>
    );
  }

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPadding + 16, paddingBottom: botPadding + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Delete Client", `Delete ${client.name}? This cannot be undone.`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete", style: "destructive",
                onPress: () => {
                  deleteClient(client.id);
                  router.back();
                },
              },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {/* Client Profile */}
      <View style={styles.profileSection}>
        <ClientBadge name={client.name} color={client.color} size="md" />
        <View>
          <Text style={[styles.clientName, { color: colors.foreground }]}>{client.name}</Text>
          {client.company ? <Text style={[styles.clientCompany, { color: colors.mutedForeground }]}>{client.company}</Text> : null}
          {client.email ? <Text style={[styles.clientEmail, { color: colors.mutedForeground }]}>{client.email}</Text> : null}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{formatHours(totalSeconds)}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>tracked</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.primary }]}>
          <Text style={[styles.statValue, { color: "#fff" }]}>{formatCurrency(totalRevenue, settings.currency)}</Text>
          <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.8)" }]}>earned</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{formatCurrency(outstanding, settings.currency)}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>outstanding</Text>
        </View>
      </View>

      {/* Rate */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Ionicons name="cash-outline" size={18} color={colors.mutedForeground} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Hourly Rate</Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>{settings.currency}{client.hourlyRate}/hr</Text>
        </View>
        {client.phone ? (
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <Ionicons name="call-outline" size={18} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Phone</Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>{client.phone}</Text>
          </View>
        ) : null}
      </View>

      {/* Invoices */}
      {clientInvoices.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invoices</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {clientInvoices.map((inv, idx) => {
              const total = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100);
              return (
                <TouchableOpacity
                  key={inv.id}
                  style={[styles.docRow, idx < clientInvoices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/invoice/[id]", params: { id: inv.id } })}
                >
                  <View>
                    <Text style={[styles.docNum, { color: colors.foreground }]}>{inv.invoiceNumber}</Text>
                    <Text style={[styles.docDate, { color: colors.mutedForeground }]}>
                      {new Date(inv.createdAt).toLocaleDateString("en-ZA")}
                    </Text>
                  </View>
                  <View style={styles.docRight}>
                    <Text style={[styles.docAmt, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
                    <StatusBadge status={inv.status} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Quotes */}
      {clientQuotes.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quotes</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {clientQuotes.map((q, idx) => {
              const total = q.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + q.taxPercent / 100);
              return (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.docRow, idx < clientQuotes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/quote/[id]", params: { id: q.id } })}
                >
                  <View>
                    <Text style={[styles.docNum, { color: colors.foreground }]}>{q.quoteNumber}</Text>
                    <Text style={[styles.docDate, { color: colors.mutedForeground }]}>
                      {new Date(q.createdAt).toLocaleDateString("en-ZA")}
                    </Text>
                  </View>
                  <View style={styles.docRight}>
                    <Text style={[styles.docAmt, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 24 },
  profileSection: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, marginBottom: 24 },
  clientName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  clientCompany: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  clientEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  statBox: { flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  listCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  docRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  docNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  docRight: { alignItems: "flex-end", gap: 4 },
  docAmt: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
