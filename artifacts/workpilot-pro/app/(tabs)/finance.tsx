import { AppIcon } from "@/components/AppIcon";
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

import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheet } from "@/components/BottomSheet";
import { ClientBadge } from "@/components/ClientBadge";
import { ClientDropdown } from "@/components/ClientDropdown";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useSubscription } from "@/lib/revenuecat";
import type { InvoiceItem, QuoteItem } from "@/context/AppContext";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function calcTotal(items: InvoiceItem[] | QuoteItem[], taxPercent: number) {
  const sub = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  return sub * (1 + taxPercent / 100);
}

type Tab = "invoices" | "quotes" | "templates";

export default function FinanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    clients, invoices, quotes, quoteTemplates,
    timeEntries, updateTimeEntry,
    addInvoice, addQuote, deleteInvoice, deleteQuote, deleteQuoteTemplate,
    markInvoicePaid, convertQuoteToInvoice, updateInvoice, updateQuote,
    addQuoteTemplate, settings, startTimer, activeTimers,
  } = useApp();
  const { isPro } = useSubscription();

  const [showTimerUpgrade, setShowTimerUpgrade] = useState(false);

  const handleStartTimerForQuote = (quote: typeof quotes[0]) => {
    if (!isPro && activeTimers.length >= 1) {
      setShowTimerUpgrade(true);
      return;
    }
    const client = clients.find((c) => c.id === quote.clientId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startTimer({
      clientId: quote.clientId,
      projectId: "",
      taskId: null,
      description: quote.title || (client ? `Work for ${client.name}` : "Quote work"),
      hourlyRate: client?.hourlyRate ?? settings.defaultHourlyRate,
      billable: true,
    });
    router.push("/(tabs)/work" as any);
  };

  const [tab, setTab] = useState<Tab>("invoices");
  const [showNew, setShowNew] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [taxPct, setTaxPct] = useState(settings.defaultTaxPercent.toString());
  const [itemDesc, setItemDesc] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [formError, setFormError] = useState("");
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{ id: string; isInvoice: boolean } | null>(null);
  const [includeUnbilledEntries, setIncludeUnbilledEntries] = useState(false);

  // Unbilled time entries for the currently selected client
  const clientUnbilledEntries = useMemo(() =>
    selectedClientId
      ? timeEntries.filter((e) => e.billable && !e.invoiceId && !!e.endTime && e.clientId === selectedClientId)
      : []
  , [timeEntries, selectedClientId]);

  const addLineItem = () => {
    if (!itemDesc.trim() || !itemPrice) return;
    setLineItems((prev) => [...prev, { id: Date.now().toString(), description: itemDesc.trim(), quantity: parseFloat(itemQty) || 1, unitPrice: parseFloat(itemPrice) || 0 }]);
    setItemDesc(""); setItemQty("1"); setItemPrice("");
    setFormError("");
  };

  const openNew = () => {
    setSelectedClientId(clients[0]?.id || "");
    setTitle(""); setNotes(""); setLineItems([]);
    setItemDesc(""); setItemQty("1"); setItemPrice("");
    setTaxPct(settings.defaultTaxPercent.toString());
    setFormError("");
    setIncludeUnbilledEntries(false);
    setShowNew(true);
  };

  const handleCreate = () => {
    // Auto-add any pending line item the user may have typed but not committed
    let finalItems = lineItems;
    if (itemDesc.trim() && itemPrice) {
      const pending = { id: Date.now().toString(), description: itemDesc.trim(), quantity: parseFloat(itemQty) || 1, unitPrice: parseFloat(itemPrice) || 0 };
      finalItems = [...lineItems, pending];
      setLineItems(finalItems);
      setItemDesc(""); setItemQty("1"); setItemPrice("");
    }
    if (!selectedClientId) { setFormError("Please select a client above."); return; }
    if (finalItems.length === 0) { setFormError("Add at least one line item with a description and price."); return; }
    setFormError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    if (tab === "invoices") {
      const newInvoiceId = addInvoice({ clientId: selectedClientId, title: title || "Invoice", items: finalItems, notes, taxPercent: parseFloat(taxPct) || 0, status: "draft", dueDate: dueDate.toISOString(), paidAt: null, quoteId: null });
      // Link any selected unbilled time entries to this invoice
      if (includeUnbilledEntries && clientUnbilledEntries.length > 0) {
        for (const entry of clientUnbilledEntries) {
          updateTimeEntry(entry.id, { invoiceId: newInvoiceId });
        }
      }
    } else {
      addQuote({ clientId: selectedClientId, title: title || "Quote", items: finalItems, notes, taxPercent: parseFloat(taxPct) || 0, status: "draft", validUntil: dueDate.toISOString() });
    }
    setShowNew(false); setTitle(""); setNotes(""); setLineItems([]); setIncludeUnbilledEntries(false);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || lineItems.length === 0) return;
    addQuoteTemplate({ name: templateName.trim(), items: lineItems, taxPercent: parseFloat(taxPct) || 0, notes });
    setShowTemplate(false); setTemplateName("");
  };

  const loadTemplate = (templateId: string) => {
    const t = quoteTemplates.find((t) => t.id === templateId);
    if (!t) return;
    setLineItems(t.items.map((item) => ({ ...item, id: Date.now().toString() + Math.random() })));
    setTaxPct(t.taxPercent.toString());
    setNotes(t.notes);
    setShowNew(true);
  };

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const listData = tab === "invoices" ? invoices : tab === "quotes" ? quotes : [];

  const renderRightActions = (item: typeof invoices[0] | typeof quotes[0], isInvoice: boolean) => (
    <View style={styles.swipeActions}>
      {isInvoice && (item as typeof invoices[0]).status === "sent" && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#10b981" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); markInvoicePaid(item.id); }}
        >
          <AppIcon name="checkmark" size={20} color="#fff" />
          <Text style={styles.swipeBtnText}>Paid</Text>
        </TouchableOpacity>
      )}
      {isInvoice && (item as typeof invoices[0]).status === "draft" && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateInvoice(item.id, { status: "sent" }); }}
        >
          <AppIcon name="send" size={18} color="#fff" />
          <Text style={styles.swipeBtnText}>Send</Text>
        </TouchableOpacity>
      )}
      {!isInvoice && (item as typeof quotes[0]).status === "accepted" && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: "#10b981" }]}
          onPress={() => handleStartTimerForQuote(item as typeof quotes[0])}
        >
          <AppIcon name="timer-outline" size={18} color="#fff" />
          <Text style={styles.swipeBtnText}>Timer</Text>
        </TouchableOpacity>
      )}
      {!isInvoice && (item as typeof quotes[0]).status === "accepted" && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); convertQuoteToInvoice(item.id); }}
        >
          <AppIcon name="document-text" size={18} color="#fff" />
          <Text style={styles.swipeBtnText}>Invoice</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#ef4444" }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPendingDeleteItem({ id: item.id, isInvoice }); }}
      >
        <AppIcon name="trash" size={18} color="#fff" />
        <Text style={styles.swipeBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Finance</Text>
        <View style={styles.headerActions}>
          {(tab === "quotes" || tab === "templates") && quoteTemplates.length > 0 && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.muted }]}
              onPress={() => setTab("templates")}
            >
              <AppIcon name="copy-outline" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={openNew}
            testID="new-finance-btn"
          >
            <AppIcon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["invoices", "quotes", "templates"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t === "templates" ? "Templates" : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
            {t !== "templates" && (
              <View style={[styles.tabCount, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tabCountText, { color: colors.mutedForeground }]}>
                  {t === "invoices" ? invoices.length : quotes.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Templates Tab */}
      {tab === "templates" && (
        quoteTemplates.length === 0 ? (
          <EmptyState
            icon="copy-outline"
            title="No templates yet"
            description="Save your common service packages as templates to reuse them instantly."
            actionLabel="Create Template"
            onAction={() => { setShowNew(true); setTab("quotes"); }}
          />
        ) : (
          <FlatList
            data={quoteTemplates}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const total = item.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
              return (
                <Swipeable renderRightActions={() => (
                  <TouchableOpacity style={[styles.swipeBtn, { backgroundColor: "#ef4444", borderRadius: 12, margin: 4 }]} onPress={() => deleteQuoteTemplate(item.id)}>
                    <AppIcon name="trash" size={18} color="#fff" />
                  </TouchableOpacity>
                )}>
                  <TouchableOpacity
                    style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => loadTemplate(item.id)}
                    testID={`template-${item.id}`}
                  >
                    <View style={styles.docTop}>
                      <View>
                        <Text style={[styles.docNum, { color: colors.foreground }]}>{item.name}</Text>
                        <Text style={[styles.docClient, { color: colors.mutedForeground }]}>{item.items.length} item{item.items.length !== 1 ? "s" : ""}</Text>
                      </View>
                      <View style={styles.docRight}>
                        <Text style={[styles.docAmount, { color: colors.foreground }]}>{settings.currency}{total.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}</Text>
                        <Text style={[styles.templateHint, { color: colors.primary }]}>Tap to use</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            }}
          />
        )
      )}

      {/* Invoices / Quotes List */}
      {tab !== "templates" && (
        listData.length === 0 ? (
          <EmptyState
            icon={tab === "invoices" ? "document-text-outline" : "clipboard-outline"}
            title={tab === "invoices" ? "No invoices yet" : "No quotes yet"}
            description={tab === "invoices" ? "Create your first invoice to start getting paid." : "Create quotes to send to clients before billing."}
            actionLabel={`New ${tab === "invoices" ? "Invoice" : "Quote"}`}
            onAction={openNew}
          />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isInvoice = tab === "invoices";
              const client = clients.find((c) => c.id === item.clientId);
              const total = calcTotal(item.items, item.taxPercent);
              return (
                <Swipeable renderRightActions={() => renderRightActions(item as any, isInvoice)}>
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
                        <Text style={[styles.docAmount, { color: colors.foreground }]}>{formatCurrency(total, settings.currency)}</Text>
                        <StatusBadge status={item.status} />
                      </View>
                    </View>
                    {!isInvoice && (item as typeof quotes[0]).status === "accepted" && (
                      <TouchableOpacity
                        style={styles.timerRow}
                        onPress={() => handleStartTimerForQuote(item as typeof quotes[0])}
                      >
                        <AppIcon name="timer-outline" size={14} color="#10b981" />
                        <Text style={styles.timerRowText}>Start Timer for this Quote</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.swipeHint}>
                      <Text style={[styles.swipeHintText, { color: colors.mutedForeground }]}>Swipe left for quick actions</Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            }}
          />
        )
      )}

      {/* New Invoice/Quote Sheet */}
      <BottomSheet visible={showNew} onClose={() => setShowNew(false)} title={`New ${tab === "invoices" ? "Invoice" : "Quote"}`}>
        {/* Template Quick Load */}
        {quoteTemplates.length > 0 && (
          <View style={styles.templateRow}>
            <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Load template:</Text>
            {quoteTemplates.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.templateChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
                onPress={() => { setLineItems(t.items.map((i) => ({ ...i, id: Date.now().toString() + Math.random() }))); setTaxPct(t.taxPercent.toString()); setNotes(t.notes); }}
              >
                <Text style={[{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 12 }]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ClientDropdown
          clients={clients}
          value={selectedClientId}
          onChange={(id) => { setSelectedClientId(id); setIncludeUnbilledEntries(false); }}
          label="Client"
          placeholder="Select a client"
        />

        {/* Unbilled time entries banner — only shown for invoices when client has unbilled entries */}
        {tab === "invoices" && clientUnbilledEntries.length > 0 && (
          <TouchableOpacity
            onPress={() => setIncludeUnbilledEntries((v) => !v)}
            style={[styles.unbilledLinkRow, {
              backgroundColor: includeUnbilledEntries ? "#f0fdf4" : colors.muted,
              borderColor: includeUnbilledEntries ? "#86efac" : colors.border,
            }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.unbilledLinkTitle, { color: includeUnbilledEntries ? "#065f46" : colors.foreground }]}>
                Link {clientUnbilledEntries.length} unbilled time entr{clientUnbilledEntries.length === 1 ? "y" : "ies"}
              </Text>
              <Text style={[styles.unbilledLinkSub, { color: includeUnbilledEntries ? "#16a34a" : colors.mutedForeground }]}>
                {clientUnbilledEntries.reduce((s, e) => s + e.durationSeconds, 0) >= 3600
                  ? `${(clientUnbilledEntries.reduce((s, e) => s + e.durationSeconds, 0) / 3600).toFixed(1)}h`
                  : `${Math.round(clientUnbilledEntries.reduce((s, e) => s + e.durationSeconds, 0) / 60)}m`
                }
                {" · "}
                {settings.currency}{clientUnbilledEntries.reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0).toFixed(0)} total
                {" · "}Mark entries as billed
              </Text>
            </View>
            <View style={[styles.unbilledToggle, {
              backgroundColor: includeUnbilledEntries ? "#10b981" : colors.border,
            }]}>
              <View style={[styles.unbilledToggleThumb, { transform: [{ translateX: includeUnbilledEntries ? 18 : 0 }] }]} />
            </View>
          </TouchableOpacity>
        )}

        <FormField label="Title" placeholder="e.g., Website Redesign" value={title} onChangeText={setTitle} />
        <FormField label="Tax %" placeholder="15" value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" />
        <Text style={[styles.sheetLabel, { color: colors.mutedForeground }]}>Line Items</Text>
        {lineItems.map((item, idx) => (
          <View key={item.id} style={[styles.lineRow, { borderColor: colors.border }]}>
            <Text style={[styles.lineDesc, { color: colors.foreground }]} numberOfLines={1}>{item.description}</Text>
            <Text style={[styles.lineAmt, { color: colors.foreground }]}>{item.quantity} × {settings.currency}{item.unitPrice}</Text>
            <TouchableOpacity onPress={() => setLineItems((p) => p.filter((_, i) => i !== idx))}>
              <AppIcon name="close-circle" size={18} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <View style={[styles.addItemRow, { backgroundColor: colors.muted, borderRadius: 10 }]}>
          <FormField label="Description" placeholder="Service description" value={itemDesc} onChangeText={setItemDesc} />
          <View style={styles.itemNumRow}>
            <View style={{ flex: 1 }}><FormField label="Qty" placeholder="1" value={itemQty} onChangeText={setItemQty} keyboardType="decimal-pad" /></View>
            <View style={{ flex: 2 }}><FormField label="Unit Price" prefix={settings.currency} placeholder="0.00" value={itemPrice} onChangeText={setItemPrice} keyboardType="decimal-pad" /></View>
          </View>
          <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: colors.primary + "22" }]} onPress={addLineItem}>
            <AppIcon name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Add Item</Text>
          </TouchableOpacity>
        </View>
        <FormField label="Notes / Payment Terms" placeholder="Payment terms, special instructions..." value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
        {lineItems.length > 0 && (
          <TouchableOpacity style={[styles.saveTemplateBtn, { borderColor: colors.primary }]} onPress={() => setShowTemplate(true)}>
            <AppIcon name="copy-outline" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>Save as Template</Text>
          </TouchableOpacity>
        )}
        {formError ? (
          <View style={{ backgroundColor: "#fee2e2", borderRadius: 8, padding: 10, marginBottom: 12 }}>
            <Text style={{ color: "#b91c1c", fontFamily: "Inter_500Medium", fontSize: 13 }}>{formError}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleCreate} testID="create-doc-btn">
          <Text style={styles.createBtnText}>Create {tab === "invoices" ? "Invoice" : "Quote"}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Save Template Sheet */}
      <BottomSheet visible={showTemplate} onClose={() => setShowTemplate(false)} title="Save Template">
        <FormField label="Template Name" placeholder="e.g., Monthly Retainer, Website Package" value={templateName} onChangeText={setTemplateName} />
        <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={handleSaveTemplate}>
          <Text style={styles.createBtnText}>Save Template</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmDialog
        visible={!!pendingDeleteItem}
        title={`Delete ${pendingDeleteItem?.isInvoice ? "Invoice" : "Quote"}`}
        message="This cannot be undone. The document will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!pendingDeleteItem) return;
          if (pendingDeleteItem.isInvoice) deleteInvoice(pendingDeleteItem.id);
          else deleteQuote(pendingDeleteItem.id);
          setPendingDeleteItem(null);
        }}
        onCancel={() => setPendingDeleteItem(null)}
      />

      <UpgradeModal
        visible={showTimerUpgrade}
        onClose={() => setShowTimerUpgrade(false)}
        title="Upgrade for Multiple Timers"
        description="You can only run one timer at a time on the free plan. Upgrade to Pro to track unlimited timers simultaneously."
        requiredPlan="pro"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  headerActions: { flexDirection: "row", gap: 8 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, marginRight: 20 },
  tabLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabCount: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabCountText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  docCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10 },
  docTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  docLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  docNum: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docClient: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  docRight: { alignItems: "flex-end", gap: 4 },
  docAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  templateHint: { fontSize: 11, fontFamily: "Inter_500Medium" },
  swipeHint: { marginTop: 4 },
  swipeHintText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#dcfce7", borderRadius: 8, alignSelf: "flex-start" },
  timerRowText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10b981" },
  swipeActions: { flexDirection: "row", gap: 4, paddingLeft: 8, alignItems: "center" },
  swipeBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 4, minWidth: 60 },
  swipeBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sheetLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.3 },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" },
  templateChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  lineDesc: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  lineAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addItemRow: { padding: 12, marginBottom: 12 },
  itemNumRow: { flexDirection: "row", gap: 8 },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 4 },
  saveTemplateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 10, marginBottom: 12 },
  createBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  unbilledLinkRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14 },
  unbilledLinkTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  unbilledLinkSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  unbilledToggle: { width: 40, height: 22, borderRadius: 11, justifyContent: "center", paddingHorizontal: 3 },
  unbilledToggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff" },
});
