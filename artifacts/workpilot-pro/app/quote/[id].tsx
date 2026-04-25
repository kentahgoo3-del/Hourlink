import { AppIcon } from "@/components/AppIcon";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

async function getLogoDataUri(logoUri?: string): Promise<string> {
  if (!logoUri) return "";
  try {
    if (logoUri.startsWith("data:")) return logoUri;
    const ext = logoUri.split(".").pop()?.split("?")[0]?.toLowerCase() || "png";
    const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext] || "image/png";
    const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: "base64" as any });
    return `data:${mime};base64,${base64}`;
  } catch { return ""; }
}

const ACCENT = "#8b5cf6";

export default function QuoteDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, quotes, updateQuote, deleteQuote, convertQuoteToInvoice, settings, companyProfile, startTimer } = useApp();

  const [showTimerPrompt, setShowTimerPrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const companyName = companyProfile.name || settings.name || "Your Company";
  const logoUri = (companyProfile as any).logoUri as string | undefined;
  const fmt = (n: number) =>
    `${settings.currency}${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDelete = () => setShowDeleteConfirm(true);

  const handleExportPDF = async () => {
    if (!quote) return;
    setExporting(true);
    try {
      const logoDataUri = await getLogoDataUri(logoUri);
      const logoHtml = logoDataUri
        ? `<img src="${logoDataUri}" style="height:56px;max-width:180px;object-fit:contain;display:block;margin-bottom:0;" alt="logo"/>`
        : `<div style="font-size:26px;font-weight:900;color:#1e293b;">${companyName}</div>`;
      const sub = quote.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      const taxAmt = sub * (quote.taxPercent / 100);
      const tot = sub + taxAmt;
      const fmtP = (n: number) => `${settings.currency}${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const itemRows = quote.items.map((item) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
            <div style="font-size:13px;font-weight:600;color:#1e293b">${item.description}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${settings.currency}${item.unitPrice.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}/unit</div>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.quantity}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#1e293b">${fmtP(item.quantity * item.unitPrice)}</td>
        </tr>`).join("");
      const addrLines = [
        companyProfile.addressLine1,
        companyProfile.city && companyProfile.province ? `${companyProfile.city}, ${companyProfile.province}` : companyProfile.city,
        companyProfile.phone,
        companyProfile.email,
        companyProfile.vatNumber ? `VAT: ${companyProfile.vatNumber}` : "",
      ].filter(Boolean).join("<br/>");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${quote.quoteNumber}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,Helvetica Neue,Arial,sans-serif;color:#1e293b;background:#fff;padding:0}
  .page{max-width:760px;margin:0 auto;padding:48px 48px 60px}
  table{width:100%;border-collapse:collapse}
  th{background:#f8fafc;padding:10px 16px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.8px;font-weight:700;text-align:left}
  th:nth-child(2){text-align:center}
  th:nth-child(3){text-align:right}
  tr:last-child td{border-bottom:none!important}
</style></head>
<body><div class="page">

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0">
    <div>
      ${logoHtml}
      ${logoDataUri ? `<div style="font-size:18px;font-weight:800;color:#1e293b;margin-top:10px">${companyName}</div>` : ""}
      ${companyProfile.tagline ? `<div style="font-size:12px;color:#94a3b8;margin-top:3px">${companyProfile.tagline}</div>` : ""}
      ${addrLines ? `<div style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.7">${addrLines}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:32px;font-weight:900;color:${ACCENT};letter-spacing:-1px">QUOTATION</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:4px">${quote.quoteNumber}</div>
      <div style="display:inline-block;margin-top:8px;background:${ACCENT}18;color:${ACCENT};border:1px solid ${ACCENT}60;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${quote.status}</div>
    </div>
  </div>

  <!-- Dates -->
  <div style="display:flex;gap:40px;margin-bottom:28px">
    <div><div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px">DATE</div><div style="font-size:13px;font-weight:600">${formatDate(quote.createdAt)}</div></div>
    <div><div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px">VALID UNTIL</div><div style="font-size:13px;font-weight:600">${formatDate(quote.validUntil)}</div></div>
  </div>

  <!-- From / Quoted For -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:20px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:28px">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">FROM</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${companyName}</div>
      ${addrLines ? `<div style="font-size:12px;color:#64748b;line-height:1.7">${addrLines}</div>` : ""}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">QUOTED FOR</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${client?.name || "Client"}</div>
      ${client?.company ? `<div style="font-size:12px;color:#64748b">${client.company}</div>` : ""}
      ${client?.email ? `<div style="font-size:12px;color:#64748b">${client.email}</div>` : ""}
      ${client?.phone ? `<div style="font-size:12px;color:#64748b">${client.phone}</div>` : ""}
    </div>
  </div>

  ${quote.title ? `<div style="font-size:15px;font-weight:700;margin-bottom:16px">${quote.title}</div>` : ""}

  <!-- Line Items -->
  <table style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
    <thead><tr>
      <th style="width:55%;border-radius:0">Description</th>
      <th style="width:20%">Qty</th>
      <th style="width:25%">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <div style="width:280px">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;color:#64748b">Subtotal</span><span style="font-size:13px">${fmtP(sub)}</span></div>
      ${quote.taxPercent > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;color:#64748b">Tax (${quote.taxPercent}%)</span><span style="font-size:13px">${fmtP(taxAmt)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;margin-top:4px;border-top:2px solid #1e293b">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">TOTAL</span>
        <span style="font-size:24px;font-weight:900;color:${ACCENT}">${fmtP(tot)}</span>
      </div>
    </div>
  </div>

  ${quote.notes ? `
  <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:16px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">NOTES</div>
    <div style="font-size:13px;color:#64748b;line-height:1.7">${quote.notes}</div>
  </div>` : ""}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <span>${companyName}</span>
    <span>Generated by HourLink</span>
  </div>

</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: quote.quoteNumber, UTI: "com.adobe.pdf" });
    } catch (e) { console.error("PDF error", e); }
    finally { setExporting(false); }
  };

  const handleAccept = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateQuote(id, { status: "accepted" });
    setShowTimerPrompt(true);
  };

  const handleStartTimerNow = () => {
    setShowTimerPrompt(false);
    const hourlyRate = client?.hourlyRate ?? settings.defaultHourlyRate ?? 0;
    startTimer({
      description: quote!.title,
      clientId: quote!.clientId || "",
      taskId: null,
      hourlyRate,
      billable: true,
    });
    router.replace("/(tabs)/work");
  };

  const handleConvert = () => setShowConvertConfirm(true);

  const doConvert = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const invoiceId = convertQuoteToInvoice(id);
    setShowConvertConfirm(false);
    router.replace({ pathname: "/invoice/[id]", params: { id: invoiceId } });
  };

  const [showMenu, setShowMenu] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Top navigation bar */}
      <View style={[styles.topBar, { paddingTop: topPadding + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
          <AppIcon name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>{quote.quoteNumber}</Text>
        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.pdfBtn, { backgroundColor: exporting ? colors.muted : ACCENT }]}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <AppIcon name="download-outline" size={14} color="#fff" />}
            <Text style={styles.pdfBtnText}>{exporting ? "…" : "PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={[styles.topBarBtn, { backgroundColor: colors.muted }]}>
            <AppIcon name="ellipsis-horizontal" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: botPadding + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quote Document Card */}
        <View style={[styles.docCard, { backgroundColor: "#fff", borderColor: colors.border, shadowColor: "#000" }]}>

          {/* Brand Header */}
          <View style={[styles.brandHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.brandLeft}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
              ) : null}
              <View style={{ marginTop: logoUri ? 10 : 0 }}>
                <Text style={styles.companyName}>{companyName}</Text>
                {companyProfile.tagline ? (
                  <Text style={styles.companyTagline}>{companyProfile.tagline}</Text>
                ) : null}
                {companyProfile.addressLine1 ? <Text style={styles.companyAddr}>{companyProfile.addressLine1}</Text> : null}
                {companyProfile.city ? (
                  <Text style={styles.companyAddr}>{companyProfile.city}{companyProfile.province ? `, ${companyProfile.province}` : ""}</Text>
                ) : null}
                {companyProfile.phone ? <Text style={styles.companyAddr}>{companyProfile.phone}</Text> : null}
                {companyProfile.email ? <Text style={styles.companyAddr}>{companyProfile.email}</Text> : null}
                {companyProfile.vatNumber ? <Text style={styles.companyAddr}>VAT: {companyProfile.vatNumber}</Text> : null}
              </View>
            </View>
            <View style={styles.brandRight}>
              <Text style={[styles.quoteWord, { color: ACCENT }]}>QUOTATION</Text>
              <Text style={styles.quoteNum}>{quote.quoteNumber}</Text>
              <StatusBadge status={quote.status} large />
            </View>
          </View>

          <View style={styles.docBody}>
            {/* Dates */}
            <View style={styles.datesRow}>
              <View>
                <Text style={styles.metaLabel}>DATE</Text>
                <Text style={styles.metaValue}>{formatDate(quote.createdAt)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>VALID UNTIL</Text>
                <Text style={styles.metaValue}>{formatDate(quote.validUntil)}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* From / Quoted For */}
            <View style={styles.fromTo}>
              <View style={styles.fromBlock}>
                <Text style={styles.metaLabel}>FROM</Text>
                <Text style={styles.fromName}>{companyName}</Text>
              </View>
              <View style={[styles.fromBlock, { alignItems: "flex-end" }]}>
                <Text style={styles.metaLabel}>QUOTED FOR</Text>
                <Text style={[styles.fromName, { textAlign: "right" }]}>{client?.name || "Client"}</Text>
                {client?.company ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.company}</Text> : null}
                {client?.email ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.email}</Text> : null}
                {client?.phone ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.phone}</Text> : null}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Title */}
            {quote.title ? <Text style={styles.docTitle}>{quote.title}</Text> : null}

            {/* Line Items */}
            <View style={[styles.lineTable, { borderColor: colors.border }]}>
              <View style={[styles.lineHeader, { backgroundColor: colors.muted }]}>
                <Text style={[styles.lineHeaderText, { flex: 3 }]}>Description</Text>
                <Text style={[styles.lineHeaderText, { flex: 1, textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.lineHeaderText, { flex: 1.5, textAlign: "right" }]}>Amount</Text>
              </View>
              {quote.items.map((item, idx) => (
                <View
                  key={item.id}
                  style={[
                    styles.lineRow,
                    { borderTopColor: colors.border },
                    idx > 0 && { borderTopWidth: 1 },
                  ]}
                >
                  <View style={{ flex: 3 }}>
                    <Text style={styles.lineDesc}>{item.description}</Text>
                    <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>
                      {settings.currency}{item.unitPrice.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}/unit
                    </Text>
                  </View>
                  <Text style={[styles.lineQty, { flex: 1, textAlign: "center", color: colors.mutedForeground }]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.lineAmt, { flex: 1.5, textAlign: "right" }]}>
                    {fmt(item.quantity * item.unitPrice)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.totalsOuter}>
              <View style={[styles.totalsBox, { borderTopColor: colors.border }]}>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                  <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
                </View>
                {quote.taxPercent > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax ({quote.taxPercent}%)</Text>
                    <Text style={styles.totalValue}>{fmt(tax)}</Text>
                  </View>
                )}
                <View style={[styles.grandRow, { borderTopColor: colors.border }]}>
                  <Text style={styles.grandLabel}>TOTAL</Text>
                  <Text style={[styles.grandAmount, { color: ACCENT }]}>{fmt(total)}</Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            {quote.notes ? (
              <View style={[styles.notesBlock, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.metaLabel, { marginBottom: 6 }]}>NOTES</Text>
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{quote.notes}</Text>
              </View>
            ) : null}

            {/* Footer */}
            <View style={[styles.docFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{companyName}</Text>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Generated by HourLink</Text>
            </View>
          </View>
        </View>

      </ScrollView>


      {/* ⋯ Menu */}
      <BottomSheet visible={showMenu} onClose={() => setShowMenu(false)} title="Quote Options">
        {quote.status === "draft" && (
          <TouchableOpacity
            style={[styles.menuItem, { borderColor: colors.border }]}
            onPress={() => { setShowMenu(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuote(id, { status: "sent" }); }}
            testID="mark-quote-sent"
          >
            <AppIcon name="send" size={18} color={colors.foreground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>Mark as Sent</Text>
          </TouchableOpacity>
        )}
        {quote.status === "sent" && (
          <>
            <TouchableOpacity
              style={[styles.menuItem, { borderColor: "#d1fae5", backgroundColor: "#f0fdf4" }]}
              onPress={() => { setShowMenu(false); handleAccept(); }}
              testID="accept-quote"
            >
              <AppIcon name="checkmark-circle" size={18} color="#10b981" />
              <Text style={[styles.menuItemText, { color: "#10b981" }]}>Mark as Accepted</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderColor: "#fee2e2", backgroundColor: "#fef2f2" }]}
              onPress={() => { setShowMenu(false); updateQuote(id, { status: "rejected" }); }}
            >
              <AppIcon name="close-circle" size={18} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Mark as Rejected</Text>
            </TouchableOpacity>
          </>
        )}
        {quote.status === "accepted" && (
          <TouchableOpacity
            style={[styles.menuItem, { borderColor: colors.border }]}
            onPress={() => { setShowMenu(false); handleConvert(); }}
            testID="convert-to-invoice"
          >
            <AppIcon name="document-text" size={18} color={colors.foreground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>Convert to Invoice</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.menuItem, { borderColor: "#fee2e2", backgroundColor: "#fef2f2" }]}
          onPress={() => { setShowMenu(false); handleDelete(); }}
        >
          <AppIcon name="trash-outline" size={18} color="#ef4444" />
          <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Delete Quote</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Quote"
        message="This cannot be undone. The quote will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { setShowDeleteConfirm(false); deleteQuote(id); router.back(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        visible={showConvertConfirm}
        title="Convert to Invoice"
        message="Create a new invoice from this quote? The quote will be marked as accepted."
        confirmLabel="Convert"
        onConfirm={doConvert}
        onCancel={() => setShowConvertConfirm(false)}
      />

      {/* Timer prompt modal */}
      <Modal transparent visible={showTimerPrompt} animationType="fade" onRequestClose={() => setShowTimerPrompt(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: "#10b98120" }]}>
              <AppIcon name="checkmark-circle" size={36} color="#10b981" />
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
              <AppIcon name="timer-outline" size={18} color="#fff" />
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

  // Top nav bar
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1 },
  topBarBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 15, fontFamily: "Inter_700Bold", marginHorizontal: 8 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 9 },
  pdfBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },

  // Menu items
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  menuItemText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Document Card
  docCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Brand Header
  brandHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 20, borderBottomWidth: 1 },
  brandLeft: { flex: 1, paddingRight: 16 },
  logo: { height: 52, width: 160, marginBottom: 8 },
  companyName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1e293b" },
  companyTagline: { fontSize: 11, color: "#94a3b8", marginTop: 2, fontFamily: "Inter_400Regular" },
  companyAddr: { fontSize: 10, color: "#94a3b8", marginTop: 1, fontFamily: "Inter_400Regular", lineHeight: 15 },
  brandRight: { alignItems: "flex-end" },
  quoteWord: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  quoteNum: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1e293b", marginTop: 2, marginBottom: 6 },

  // Body
  docBody: { padding: 20 },
  datesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", color: "#94a3b8", marginBottom: 4 },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1e293b" },
  divider: { height: 1, marginBottom: 16 },

  // From/To
  fromTo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  fromBlock: { flex: 1 },
  fromName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e293b", marginBottom: 3 },
  fromAddr: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b", lineHeight: 17 },

  docTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1e293b", marginBottom: 14 },

  // Line Items
  lineTable: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  lineHeader: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 9 },
  lineHeaderText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.6, textTransform: "uppercase", color: "#94a3b8" },
  lineRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  lineDesc: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1e293b" },
  lineSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  lineQty: { fontSize: 13, fontFamily: "Inter_400Regular" },
  lineAmt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1e293b" },

  // Totals
  totalsOuter: { alignItems: "flex-end", marginBottom: 16 },
  totalsBox: { width: "55%", borderTopWidth: 1, paddingTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  totalLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#1e293b" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 2, paddingTop: 10, marginTop: 4 },
  grandLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", color: "#1e293b" },
  grandAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },

  // Notes
  notesBlock: { borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1 },
  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },

  // Doc Footer
  docFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 14, marginTop: 4 },
  footerText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  // Actions

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 32 },
  modalCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 10 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  modalPrimaryBtn: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, justifyContent: "center" },
  modalPrimaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalSecondaryBtn: { width: "100%", borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  modalSecondaryBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
