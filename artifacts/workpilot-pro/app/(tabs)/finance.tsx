import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { InvoiceItem, QuoteItem } from "@/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function calcTotal(items: InvoiceItem[] | QuoteItem[], taxPercent: number) {
  const sub = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  return sub * (1 + taxPercent / 100);
}

type Tab = "invoices" | "quotes";

export default function FinanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, invoices, quotes,
    addInvoice, addQuote, deleteInvoice, deleteQuote,
    markInvoicePaid, convertQuoteToInvoice, settings,
  } = useApp();

  const [tab, setTab] = useState<Tab>("invoices");
  const [showNew, setShowNew] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [taxPct, setTaxPct] = useState(settings.defaultTaxPercent.toString());
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([]);

  const addLineItem = () => {
    if (!itemDesc.trim() || !itemPrice) return;
    setLineItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: itemDesc.trim(), quantity: parseFloat(itemQty) || 1, unitPrice: parseFloat(itemPrice) || 0 },
    ]);
    setItemDesc(""); setItemQty("1"); setItemPrice("");
  };

  const handleCreate = () => {
    if (!selectedClientId) { Alert.alert("Select a client"); return; }
    if (lineItems.length === 0) { Alert.alert("Add at least one line item"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    if (tab === "invoices") {
      addInvoice({
        clientId: selectedClientId,
        title: title || "Invoice",
        items: lineItems,
        notes,
        taxPercent: parseFloat(taxPct) || 0,
        status: "draft",
        dueDate: dueDate.toISOString(),
        paidAt: null,
        quoteId: null,
      });
    } else {
      addQuote({
        clientId: selectedClientId,
        title: title || "Quote",
        items: lineItems,
        notes,
        taxPercent: parseFloat(taxPct) || 0,
        status: "draft",
        validUntil: dueDate.toISOString(),
      });
    }
    setShowNew(false);
    setTitle(""); setNotes(""); setLineItems([]);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const listData = tab === "invoices" ? invoices : quotes;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Finance</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowNew(true)}
          testID="new-finance-btn"
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["invoices", "quotes"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
            <View style={[styles.tabCount, { backgroundColor: colors.muted }]}>
              <Text style={[styles.tabCountText, { color: colors.mutedForeground }]}>
                {tab === "invoices" ? invoices.length : quotes.length}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {listData.length === 0 ? (
        <EmptyState
          icon={tab === "invoices" ? "document-text-outline" : "clipboard-outline"}
          title={tab === "invoices" ? "No invoices yet" : "No quotes yet"}
          description={tab === "invoices" ? "Create your first invoice to start getting paid." : "Create quotes to send to clients before billing."}
          actionLabel={`New ${tab === "invoices" ? "Invoice" : "Quote"}`}
          onAction={() => setShowNew(true)}
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const client = clients.find((c) => c.id === item.clientId);
            const total = calcTotal(item.items, item.taxPercent);
            const isInvoice = tab === "invoices";
            return (
              <TouchableOpacity
                style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  if (isInvoice) router.push({ pathname: "/invoice/[id]", params: { id: item.id } });
                  else router.push({ pathname: "/quote/[id]", params: { id: item.id } });
                }}
                testID={`finance-card-${item.id}`}
              >
                <View style={styles.docTop}>
                  <View style={styles.docLeft}>
                    {client && <ClientBadge name={client.name} color={client.color} size="sm" />}
                    <View>
                      <Text style={[styles.docNum, { color: colors.foreground }]}>
                        {"invoiceNumber" in item ? item.invoiceNumber : item.quoteNumber}
                      </Text>
                      <Text style={[styles.docClient, { color: colors.mutedForeground }]}>{client?.name || "Unknown"}</Text>
                    </View>
                  </View>
                  <View style={styles.docRight}>
                    <Text style={[styles.docAmount, { color: colors.foreground }]}>
                      {formatCurrency(total, settings.currency)}
                    </Text>
                    <StatusBadge status={item.status} />
                  </View>
                </View>
                <View style={styles.docBottom}>
                  <Text style={[styles.docDate, { color: colors.mutedForeground }]}>
                    {formatDate(item.createdAt)}
                  </Text>
                  <View style={styles.docActions}>
                    {isInvoice && (item as typeof invoices[0]).status === "sent" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#10b98122" }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          markInvoicePaid(item.id);
                        }}
                      >
                        <Text style={{ color: "#10b981", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Mark Paid</Text>
                      </TouchableOpacity>
                    )}
                    {!isInvoice && (item as typeof quotes[0]).status === "accepted" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary + "22" }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          convertQuoteToInvoice(item.id);
                        }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Invoice</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert("Delete", `Delete this ${isInvoice ? "invoice" : "quote"}?`, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete", style: "destructive",
                            onPress: () => isInvoice ? deleteInvoice(item.id) : deleteQuote(item.id),
                          },
                        ]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <BottomSheet visible={showNew} onClose={() => setShowNew(false)} title={`New ${tab === "invoices" ? "Invoice" : "Quote"}`}>
        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Client</Text>
        <View style={styles.clientChips}>
          {clients.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, {
                backgroundColor: selectedClientId === c.id ? c.color + "22" : colors.muted,
                borderColor: selectedClientId === c.id ? c.color : "transparent",
                borderWidth: 1,
              }]}
              onPress={() => setSelectedClientId(c.id)}
            >
              <ClientBadge name={c.name} color={c.color} size="sm" />
              <Text style={[styles.chipLabel, { color: colors.foreground }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FormField label="Title" placeholder="e.g., Website Redesign" value={title} onChangeText={setTitle} />
        <FormField label="Tax %" placeholder="15" value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" />

        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Line Items</Text>
        {lineItems.map((item, idx) => (
          <View key={item.id} style={[styles.lineRow, { borderColor: colors.border }]}>
            <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.lineAmt, { color: colors.foreground }]}>
              {item.quantity} × {settings.currency}{item.unitPrice}
            </Text>
            <TouchableOpacity onPress={() => setLineItems((p) => p.filter((_, i) => i !== idx))}>
              <Ionicons name="close-circle" size={18} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={[styles.addItemRow, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          <FormField label="Description" placeholder="Service description" value={itemDesc} onChangeText={setItemDesc} />
          <View style={styles.itemNumRow}>
            <View style={{ flex: 1 }}>
              <FormField label="Qty" placeholder="1" value={itemQty} onChangeText={setItemQty} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 2 }}>
              <FormField label="Unit Price" prefix={settings.currency} placeholder="0.00" value={itemPrice} onChangeText={setItemPrice} keyboardType="decimal-pad" />
            </View>
          </View>
          <TouchableOpacity
            style={[styles.addItemBtn, { backgroundColor: colors.primary + "22" }]}
            onPress={addLineItem}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <FormField label="Notes" placeholder="Payment terms, special instructions..." value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleCreate} testID="create-doc-btn">
          <Text style={styles.createBtnText}>Create {tab === "invoices" ? "Invoice" : "Quote"}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, marginRight: 24 },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabCount: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabCountText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  docCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  docTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  docLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  docNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docClient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  docRight: { alignItems: "flex-end", gap: 4 },
  docAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  docBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  docDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  docActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  sheetLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.3 },
  clientChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  lineDesc: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  lineAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addItemRow: { padding: 12, marginBottom: 12 },
  itemNumRow: { flexDirection: "row", gap: 8 },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 4 },
  createBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
