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
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function QuoteDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { quotes, clients, updateQuote, deleteQuote, convertQuoteToInvoice, settings } = useApp();

  const quote = quotes.find((q) => q.id === id);
  const client = clients.find((c) => c.id === quote?.clientId);

  const subtotal = useMemo(() =>
    quote?.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) || 0,
    [quote]
  );
  const taxAmount = subtotal * ((quote?.taxPercent || 0) / 100);
  const total = subtotal + taxAmount;

  if (!quote) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <Text style={{ color: colors.mutedForeground }}>Quote not found</Text>
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
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Delete Quote", "Delete this quote?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => { deleteQuote(quote.id); router.back(); } },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={22} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={styles.topSection}>
        <View style={styles.quoteHeader}>
          <Text style={[styles.quoteNum, { color: colors.foreground }]}>{quote.quoteNumber}</Text>
          <StatusBadge status={quote.status} />
        </View>
        {quote.title ? <Text style={[styles.quoteTitle, { color: colors.mutedForeground }]}>{quote.title}</Text> : null}
      </View>

      {client && (
        <View style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.billTo, { color: colors.mutedForeground }]}>Quote For</Text>
          <View style={styles.clientRow}>
            <ClientBadge name={client.name} color={client.color} size="sm" />
            <View>
              <Text style={[styles.clientName, { color: colors.foreground }]}>{client.name}</Text>
              {client.company ? <Text style={[styles.clientSub, { color: colors.mutedForeground }]}>{client.company}</Text> : null}
            </View>
          </View>
          <View style={[styles.dateRow, { borderTopColor: colors.border }]}>
            <View>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Created</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>{new Date(quote.createdAt).toLocaleDateString("en-ZA")}</Text>
            </View>
            <View>
              <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>Valid Until</Text>
              <Text style={[styles.dateValue, { color: colors.foreground }]}>{new Date(quote.validUntil).toLocaleDateString("en-ZA")}</Text>
            </View>
          </View>
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Items</Text>
      <View style={[styles.itemsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.itemHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.itemHeaderText, { color: colors.mutedForeground, flex: 3 }]}>Description</Text>
          <Text style={[styles.itemHeaderText, { color: colors.mutedForeground }]}>Qty</Text>
          <Text style={[styles.itemHeaderText, { color: colors.mutedForeground, textAlign: "right" }]}>Amount</Text>
        </View>
        {quote.items.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.itemRow, idx < quote.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <Text style={[styles.itemDesc, { color: colors.foreground, flex: 3 }]} numberOfLines={2}>{item.description}</Text>
            <Text style={[styles.itemQty, { color: colors.mutedForeground }]}>{item.quantity}</Text>
            <Text style={[styles.itemAmt, { color: colors.foreground, textAlign: "right" }]}>
              {formatCurrency(item.quantity * item.unitPrice, settings.currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.totalsSection, { borderTopColor: colors.border }]}>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatCurrency(subtotal, settings.currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax ({quote.taxPercent}%)</Text>
            <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatCurrency(taxAmount, settings.currency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={[styles.grandTotalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: colors.primary }]}>{formatCurrency(total, settings.currency)}</Text>
          </View>
        </View>
      </View>

      {quote.notes ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
          <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{quote.notes}</Text>
          </View>
        </>
      ) : null}

      {/* Actions */}
      {(quote.status === "draft" || quote.status === "sent") && (
        <View style={styles.actionsRow}>
          {quote.status === "draft" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuote(quote.id, { status: "sent" }); }}
              testID="mark-sent-quote"
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Sent</Text>
            </TouchableOpacity>
          )}
          {quote.status === "sent" && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); updateQuote(quote.id, { status: "accepted" }); }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                onPress={() => updateQuote(quote.id, { status: "rejected" })}
              >
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      {quote.status === "accepted" && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              convertQuoteToInvoice(quote.id);
              router.back();
            }}
            testID="convert-to-invoice-btn"
          >
            <Ionicons name="document-text-outline" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Convert to Invoice</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 },
  topSection: { paddingHorizontal: 20, marginBottom: 20 },
  quoteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  quoteNum: { fontSize: 24, fontFamily: "Inter_700Bold" },
  quoteTitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 },
  clientCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  billTo: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  clientName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  clientSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 14 },
  dateLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.4 },
  dateValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },
  itemsCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  itemHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  itemHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  itemDesc: { fontSize: 14, fontFamily: "Inter_400Regular" },
  itemQty: { fontSize: 14, fontFamily: "Inter_400Regular", width: 30 },
  itemAmt: { fontSize: 14, fontFamily: "Inter_600SemiBold", width: 80 },
  totalsSection: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  grandTotal: { marginTop: 8, paddingTop: 8 },
  grandTotalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandTotalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  notesCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 16 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 24, flexWrap: "wrap" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
