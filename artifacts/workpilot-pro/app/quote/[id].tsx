import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export default function QuoteDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, quotes, updateQuote, deleteQuote, convertQuoteToInvoice, settings, companyProfile, startTimer, activeTimer } = useApp();
  const [showTimerPrompt, setShowTimerPrompt] = useState(false);

  const quote = quotes.find((q) => q.id === id);
  const client = clients.find((c) => c.id === quote?.clientId);

  const subtotal = useMemo(() => quote?.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) ?? 0, [quote]);
  const tax = subtotal * ((quote?.taxPercent ?? 0) / 100);
  const total = subtotal + tax;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!quote) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.foreground }]}>Quote not found</Text>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert("Delete Quote", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deleteQuote(id); router.back(); } },
    ]);
  };

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateQuote(id, { status: "accepted" });
    setShowTimerPrompt(true);
  };

  const handleStartTimerNow = () => {
    setShowTimerPrompt(false);
    if (activeTimer) return;
    const hourlyRate = client?.hourlyRate ?? settings.defaultHourlyRate ?? 0;
    startTimer({
      description: quote!.title,
      clientId: quote!.clientId || null,
      taskId: null,
      hourlyRate,
      billable: true,
    });
    router.replace("/(tabs)/work");
  };

  const handleConvert = () => {
    Alert.alert("Convert to Invoice", "Create a new invoice from this quote?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Convert", onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const invoiceId = convertQuoteToInvoice(id);
          router.replace({ pathname: "/invoice/[id]", params: { id: invoiceId } });
        }
      },
    ]);
  };

  const companyName = companyProfile.name || settings.name || "Your Company";
  const hasCompanyInfo = !!(companyProfile.name || companyProfile.addressLine1 || companyProfile.phone);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerNum, { color: colors.foreground }]}>{quote.quoteNumber}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <StatusBadge status={quote.status} large />
          <Text style={[styles.validUntil, { color: colors.mutedForeground }]}>Valid until {formatDate(quote.validUntil)}</Text>
        </View>

        <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.companyHeader, { borderBottomColor: colors.border, backgroundColor: colors.primary + "0a" }]}>
            {(companyProfile as any).logoUri && (
              <Image source={{ uri: (companyProfile as any).logoUri }} style={styles.companyLogo} resizeMode="contain" />
            )}
            <View style={styles.companyInfo}>
              <Text style={[styles.companyName, { color: colors.foreground }]}>{companyName}</Text>
              {companyProfile.tagline ? <Text style={[styles.companySub, { color: colors.mutedForeground }]}>{companyProfile.tagline}</Text> : null}
            </View>
          </View>

          <View style={{ padding: 20 }}>
            <View style={styles.metaRow}>
              <View>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>QUOTATION</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{quote.quoteNumber}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>DATE</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatDate(quote.createdAt)}</Text>
              </View>
            </View>

            <View style={[styles.fromTo, { borderTopColor: colors.border }]}>
              <View style={styles.fromBlock}>
                <Text style={[styles.fromLabel, { color: colors.mutedForeground }]}>FROM</Text>
                <Text style={[styles.fromName, { color: colors.foreground }]}>{companyName}</Text>
                {hasCompanyInfo && (
                  <>
                    {companyProfile.addressLine1 ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.addressLine1}</Text> : null}
                    {companyProfile.city ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.city}, {companyProfile.province}</Text> : null}
                    {companyProfile.phone ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.phone}</Text> : null}
                    {companyProfile.vatNumber ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>VAT: {companyProfile.vatNumber}</Text> : null}
                  </>
                )}
              </View>
              <View style={styles.fromBlock}>
                <Text style={[styles.fromLabel, { color: colors.mutedForeground }]}>QUOTED FOR</Text>
                <Text style={[styles.fromName, { color: colors.foreground }]}>{client?.name || "Client"}</Text>
                {client?.company ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{client.company}</Text> : null}
                {client?.email ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{client.email}</Text> : null}
              </View>
            </View>

            {quote.title ? <Text style={[styles.docTitle, { color: colors.foreground }]}>{quote.title}</Text> : null}

            <View style={[styles.lineTable, { borderColor: colors.border }]}>
              <View style={[styles.lineHeader, { backgroundColor: colors.muted }]}>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 3 }]}>Description</Text>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 1, textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 1.5, textAlign: "right" }]}>Amount</Text>
              </View>
              {quote.items.map((item, idx) => (
                <View key={item.id} style={[styles.lineRow, idx < quote.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.lineDesc, { color: colors.foreground }]}>{item.description}</Text>
                    <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>{settings.currency}{item.unitPrice}/unit</Text>
                  </View>
                  <Text style={[{ flex: 1, textAlign: "center", fontSize: 13, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{item.quantity}</Text>
                  <Text style={[{ flex: 1.5, textAlign: "right", fontSize: 13, color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {settings.currency}{(item.quantity * item.unitPrice).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{settings.currency}{subtotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax ({quote.taxPercent}%)</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{settings.currency}{tax.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.grandLabel, { color: colors.foreground }]}>TOTAL</Text>
                <Text style={[styles.grandAmount, { color: colors.primary }]}>{settings.currency}{total.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {quote.notes ? (
              <View style={[styles.notesBlock, { borderTopColor: colors.border }]}>
                <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{quote.notes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          {quote.status === "draft" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuote(id, { status: "sent" }); }}
              testID="mark-quote-sent"
            >
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark as Sent</Text>
            </TouchableOpacity>
          )}
          {quote.status === "sent" && (
            <View style={styles.sentActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#10b981" }]}
                onPress={handleAccept}
                testID="accept-quote"
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Accepted</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#ef4444" }]}
                onPress={() => updateQuote(id, { status: "rejected" })}
              >
                <Ionicons name="close" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Rejected</Text>
              </TouchableOpacity>
            </View>
          )}
          {quote.status === "accepted" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleConvert}
              testID="convert-to-invoice"
            >
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Convert to Invoice</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Timer prompt modal */}
      <Modal transparent visible={showTimerPrompt} animationType="fade" onRequestClose={() => setShowTimerPrompt(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#10b98120" }]}>
              <Ionicons name="checkmark-circle" size={36} color="#10b981" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Quote Accepted!</Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              Ready to start work on{"\n"}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{quote.title}</Text>?
            </Text>
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, { backgroundColor: "#10b981" }]}
              onPress={handleStartTimerNow}
            >
              <Ionicons name="timer-outline" size={18} color="#fff" />
              <Text style={styles.modalPrimaryBtnText}>Start Timer Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSecondaryBtn, { borderColor: colors.border }]}
              onPress={() => setShowTimerPrompt(false)}
            >
              <Text style={[styles.modalSecondaryBtnText, { color: colors.mutedForeground }]}>Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { textAlign: "center", marginTop: 100, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 32 },
  modalCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 10 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  modalPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, justifyContent: "center" },
  modalPrimaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalSecondaryBtn: { width: "100%", borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  modalSecondaryBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerNum: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  validUntil: { fontSize: 12, fontFamily: "Inter_400Regular" },
  docCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  companyHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, borderBottomWidth: 1 },
  companyLogo: { width: 240, height: 108 },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  companySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  fromTo: { flexDirection: "row", gap: 20, borderTopWidth: 1, paddingTop: 20, marginBottom: 20 },
  fromBlock: { flex: 1 },
  fromLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  fromName: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  fromAddr: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  docTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  lineTable: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  lineHeader: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10 },
  lineHeaderText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  lineRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  lineDesc: { fontSize: 13, fontFamily: "Inter_500Medium" },
  lineSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  totalsBlock: { alignItems: "flex-end", gap: 6, marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: "55%" },
  totalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  grandRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 4, width: "100%" },
  grandLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  grandAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  notesBlock: { borderTopWidth: 1, paddingTop: 16 },
  notesLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  actions: { gap: 10 },
  sentActions: { flexDirection: "row", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
