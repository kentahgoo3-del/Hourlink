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
import { FormField } from "@/components/FormField";
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
    const ext = logoUri.split(".").pop()?.toLowerCase() || "png";
    const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext] || "image/png";
    const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: "base64" as any });
    return `data:${mime};base64,${base64}`;
  } catch { return ""; }
}

export default function InvoiceDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, invoices, updateInvoice, deleteInvoice, markInvoicePaid, settings, companyProfile } = useApp();

  const invoice = invoices.find((inv) => inv.id === id);
  const client = clients.find((c) => c.id === invoice?.clientId);

  const [showEdit, setShowEdit] = useState(false);
  const [editNotes, setEditNotes] = useState(invoice?.notes || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  const subtotal = useMemo(() => invoice?.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) ?? 0, [invoice]);
  const tax = subtotal * ((invoice?.taxPercent ?? 0) / 100);
  const total = subtotal + tax;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;

  if (!invoice) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFound, { color: colors.foreground }]}>Invoice not found</Text>
      </View>
    );
  }

  const companyName = companyProfile.name || settings.name || "Your Company";
  const logoUri = (companyProfile as any).logoUri as string | undefined;
  const fmt = (n: number) =>
    `${settings.currency}${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDelete = () => setShowDeleteConfirm(true);

  const handleExportPDF = async () => {
    if (!invoice) return;
    setExporting(true);
    try {
      const logoDataUri = await getLogoDataUri(logoUri);
      const logoHtml = logoDataUri
        ? `<img src="${logoDataUri}" style="height:56px;max-width:180px;object-fit:contain;display:block;margin-bottom:0;" alt="logo"/>`
        : `<div style="font-size:26px;font-weight:900;color:#1e293b;letter-spacing:-0.5px">${companyName}</div>`;
      const cName = companyName;
      const sub = invoice.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      const taxAmt = sub * (invoice.taxPercent / 100);
      const tot = sub + taxAmt;
      const fmtP = (n: number) => `${settings.currency}${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const itemRows = invoice.items
        .map((item) => `
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9">
              <div style="font-size:13px;font-weight:600;color:#1e293b">${item.description}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px">${settings.currency}${item.unitPrice.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}/unit</div>
            </td>
            <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:13px;color:#64748b">${item.quantity}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:13px;font-weight:700;color:#1e293b">${fmtP(item.quantity * item.unitPrice)}</td>
          </tr>`).join("");
      const statusColor = invoice.status === "paid" ? "#10b981" : invoice.status === "overdue" ? "#ef4444" : "#64748b";
      const addrLines = [
        companyProfile.addressLine1,
        companyProfile.city && companyProfile.province ? `${companyProfile.city}, ${companyProfile.province}` : companyProfile.city,
        companyProfile.phone,
        companyProfile.email,
        companyProfile.vatNumber ? `VAT: ${companyProfile.vatNumber}` : "",
      ].filter(Boolean).join("<br/>");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${invoice.invoiceNumber}</title>
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
      ${logoDataUri ? `<div style="font-size:18px;font-weight:800;color:#1e293b;margin-top:10px">${cName}</div>` : ""}
      ${companyProfile.tagline ? `<div style="font-size:12px;color:#94a3b8;margin-top:3px">${companyProfile.tagline}</div>` : ""}
      ${addrLines ? `<div style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.7">${addrLines}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:32px;font-weight:900;color:#3b82f6;letter-spacing:-1px">INVOICE</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:4px">${invoice.invoiceNumber}</div>
      <div style="display:inline-block;margin-top:8px;background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}60;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${invoice.status}</div>
    </div>
  </div>

  <!-- Dates row -->
  <div style="display:flex;gap:40px;margin-bottom:28px">
    <div><div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px">ISSUE DATE</div><div style="font-size:13px;font-weight:600">${formatDate(invoice.createdAt)}</div></div>
    <div><div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:5px">DUE DATE</div><div style="font-size:13px;font-weight:600;color:${invoice.status === "overdue" ? "#ef4444" : "#1e293b"}">${formatDate(invoice.dueDate)}</div></div>
  </div>

  <!-- From / Bill To -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;padding:20px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin-bottom:28px">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">FROM</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${cName}</div>
      ${addrLines ? `<div style="font-size:12px;color:#64748b;line-height:1.7">${addrLines}</div>` : ""}
    </div>
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">BILL TO</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${client?.name || "Client"}</div>
      ${client?.company ? `<div style="font-size:12px;color:#64748b">${client.company}</div>` : ""}
      ${client?.email ? `<div style="font-size:12px;color:#64748b">${client.email}</div>` : ""}
      ${client?.phone ? `<div style="font-size:12px;color:#64748b">${client.phone}</div>` : ""}
    </div>
  </div>

  ${invoice.title ? `<div style="font-size:15px;font-weight:700;margin-bottom:16px">${invoice.title}</div>` : ""}

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
      ${invoice.taxPercent > 0 ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;color:#64748b">Tax (${invoice.taxPercent}%)</span><span style="font-size:13px">${fmtP(taxAmt)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;margin-top:4px;border-top:2px solid #1e293b">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">TOTAL DUE</span>
        <span style="font-size:24px;font-weight:900;color:#3b82f6">${fmtP(tot)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:16px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">NOTES</div>
    <div style="font-size:13px;color:#64748b;line-height:1.7">${invoice.notes}</div>
  </div>` : ""}

  ${(companyProfile.bankName || companyProfile.bankAccount) ? `
  <div style="background:#f0fdf4;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#064e3b;margin-bottom:8px">BANKING DETAILS</div>
    ${companyProfile.bankName ? `<div style="font-size:13px;color:#065f46;margin-top:3px">Bank: ${companyProfile.bankName}</div>` : ""}
    ${companyProfile.bankAccount ? `<div style="font-size:13px;color:#065f46;margin-top:3px">Account: ${companyProfile.bankAccount}</div>` : ""}
    ${companyProfile.bankBranch ? `<div style="font-size:13px;color:#065f46;margin-top:3px">Branch: ${companyProfile.bankBranch}</div>` : ""}
  </div>` : ""}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <span>${cName}</span>
    <span>Generated by HourLink</span>
  </div>

</div></body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${invoice.invoiceNumber}`, UTI: "com.adobe.pdf" });
    } catch (e) { console.error("PDF error", e); }
    finally { setExporting(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding + 8, padding: 16, paddingBottom: botPadding + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Document Card */}
        <View style={[styles.docCard, { backgroundColor: "#fff", borderColor: colors.border, shadowColor: "#000" }]}>

          {/* Brand Header — logo left, invoice number right */}
          <View style={[styles.brandHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.brandLeft}>
              {logoUri ? (
                <Image
                  source={{ uri: logoUri }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : null}
              <View style={{ marginTop: logoUri ? 10 : 0 }}>
                <Text style={styles.companyName}>{companyName}</Text>
                {companyProfile.tagline ? (
                  <Text style={styles.companyTagline}>{companyProfile.tagline}</Text>
                ) : null}
                {companyProfile.addressLine1 ? (
                  <Text style={styles.companyAddr}>{companyProfile.addressLine1}</Text>
                ) : null}
                {companyProfile.city ? (
                  <Text style={styles.companyAddr}>{companyProfile.city}{companyProfile.province ? `, ${companyProfile.province}` : ""}</Text>
                ) : null}
                {companyProfile.phone ? <Text style={styles.companyAddr}>{companyProfile.phone}</Text> : null}
                {companyProfile.email ? <Text style={styles.companyAddr}>{companyProfile.email}</Text> : null}
                {companyProfile.vatNumber ? <Text style={styles.companyAddr}>VAT: {companyProfile.vatNumber}</Text> : null}
              </View>
            </View>
            <View style={styles.brandRight}>
              <Text style={[styles.invoiceWord, { color: colors.primary }]}>INVOICE</Text>
              <Text style={styles.invoiceNum}>{invoice.invoiceNumber}</Text>
              <StatusBadge status={invoice.status} large />
            </View>
          </View>

          <View style={styles.docBody}>
            {/* Dates */}
            <View style={styles.datesRow}>
              <View>
                <Text style={styles.metaLabel}>ISSUE DATE</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.createdAt)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.metaLabel}>DUE DATE</Text>
                <Text style={[styles.metaValue, invoice.status === "overdue" && { color: "#ef4444" }]}>
                  {formatDate(invoice.dueDate)}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* From / Bill To */}
            <View style={styles.fromTo}>
              <View style={styles.fromBlock}>
                <Text style={styles.metaLabel}>FROM</Text>
                <Text style={styles.fromName}>{companyName}</Text>
              </View>
              <View style={[styles.fromBlock, { alignItems: "flex-end" }]}>
                <Text style={styles.metaLabel}>BILL TO</Text>
                <Text style={[styles.fromName, { textAlign: "right" }]}>{client?.name || "Client"}</Text>
                {client?.company ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.company}</Text> : null}
                {client?.email ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.email}</Text> : null}
                {client?.phone ? <Text style={[styles.fromAddr, { textAlign: "right" }]}>{client.phone}</Text> : null}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Title */}
            {invoice.title ? (
              <Text style={styles.invoiceTitle}>{invoice.title}</Text>
            ) : null}

            {/* Line Items */}
            <View style={[styles.lineTable, { borderColor: colors.border }]}>
              <View style={[styles.lineHeader, { backgroundColor: colors.muted }]}>
                <Text style={[styles.lineHeaderText, { flex: 3 }]}>Description</Text>
                <Text style={[styles.lineHeaderText, { flex: 1, textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.lineHeaderText, { flex: 1.5, textAlign: "right" }]}>Amount</Text>
              </View>
              {invoice.items.map((item, idx) => (
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
                {invoice.taxPercent > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax ({invoice.taxPercent}%)</Text>
                    <Text style={styles.totalValue}>{fmt(tax)}</Text>
                  </View>
                )}
                <View style={[styles.grandRow, { borderTopColor: colors.border }]}>
                  <Text style={styles.grandLabel}>TOTAL DUE</Text>
                  <Text style={[styles.grandAmount, { color: colors.primary }]}>{fmt(total)}</Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            {invoice.notes ? (
              <View style={[styles.notesBlock, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.metaLabel, { marginBottom: 6 }]}>NOTES</Text>
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Banking Details */}
            {(companyProfile.bankName || companyProfile.bankAccount) && (
              <View style={[styles.bankBlock, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
                <Text style={[styles.metaLabel, { color: "#065f46", marginBottom: 8 }]}>BANKING DETAILS</Text>
                {companyProfile.bankName ? (
                  <Text style={styles.bankRow}>Bank: {companyProfile.bankName}</Text>
                ) : null}
                {companyProfile.bankAccount ? (
                  <Text style={styles.bankRow}>Account: {companyProfile.bankAccount}</Text>
                ) : null}
                {companyProfile.bankBranch ? (
                  <Text style={styles.bankRow}>Branch: {companyProfile.bankBranch}</Text>
                ) : null}
              </View>
            )}

            {/* Document Footer */}
            <View style={[styles.docFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>{companyName}</Text>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Generated by HourLink</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {invoice.status === "draft" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateInvoice(id, { status: "sent" }); }}
              testID="mark-sent-btn"
            >
              <AppIcon name="send" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark as Sent</Text>
            </TouchableOpacity>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); markInvoicePaid(id); }}
              testID="mark-paid-btn"
            >
              <AppIcon name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark as Paid</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: exporting ? colors.muted : colors.primary }]}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name="download-outline" size={18} color="#fff" />}
            <Text style={styles.actionBtnText}>{exporting ? "Generating PDF…" : "Export PDF"}</Text>
          </TouchableOpacity>
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
              onPress={() => setShowEdit(true)}
            >
              <AppIcon name="pencil" size={16} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Edit Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: "#fef2f2", borderColor: "#fee2e2", flex: 1 }]}
              onPress={handleDelete}
            >
              <AppIcon name="trash-outline" size={16} color="#ef4444" />
              <Text style={[styles.secondaryBtnText, { color: "#ef4444" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>



      {/* Edit Notes Sheet */}
      <BottomSheet visible={showEdit} onClose={() => setShowEdit(false)} title="Edit Invoice">
        <FormField
          label="Notes"
          placeholder="Payment terms, instructions..."
          value={editNotes}
          onChangeText={setEditNotes}
          multiline
          numberOfLines={4}
        />
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={() => { updateInvoice(id, { notes: editNotes }); setShowEdit(false); }}
        >
          <Text style={styles.actionBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete Invoice"
        message="This cannot be undone. The invoice will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { setShowDeleteConfirm(false); deleteInvoice(id); router.back(); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { textAlign: "center", marginTop: 100, fontSize: 16 },


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
  invoiceWord: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  invoiceNum: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1e293b", marginTop: 2, marginBottom: 6 },

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

  invoiceTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1e293b", marginBottom: 14 },

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

  // Notes & Banking
  notesBlock: { borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1 },
  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
  bankBlock: { borderRadius: 10, padding: 14, borderWidth: 1, marginBottom: 12 },
  bankRow: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#065f46", marginTop: 3 },

  // Doc Footer
  docFooter: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 14, marginTop: 4 },
  footerText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  // Actions
  actions: { gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },

  // Menu Items
  secondaryActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, borderWidth: 1, paddingVertical: 13 },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
