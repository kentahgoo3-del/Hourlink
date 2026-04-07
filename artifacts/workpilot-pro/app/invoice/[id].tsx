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
    const ext = logoUri.split(".").pop()?.toLowerCase() || "png";
    const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
    const mime = mimeMap[ext] || "image/png";
    const base64 = await FileSystem.readAsStringAsync(logoUri, { encoding: FileSystem.EncodingType.Base64 });
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
  const [editDue, setEditDue] = useState(invoice?.dueDate ? formatDate(invoice.dueDate) : "");
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

  const handleDelete = () => setShowDeleteConfirm(true);

  const handleExportPDF = async () => {
    if (!invoice) return;
    setExporting(true);
    try {
      const logoDataUri = await getLogoDataUri((companyProfile as any).logoUri);
      const logoHtml = logoDataUri ? `<img src="${logoDataUri}" style="max-height:100px;max-width:240px;object-fit:contain;display:block;margin-bottom:12px;" alt="logo"/>` : "";
      const cName = companyProfile.name || settings.name || "Your Company";
      const hasAddr = !!(companyProfile.addressLine1 || companyProfile.city || companyProfile.phone || companyProfile.email);
      const sub = invoice.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      const taxAmt = sub * (invoice.taxPercent / 100);
      const tot = sub + taxAmt;
      const fmt = (n: number) => `${settings.currency}${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const itemRows = invoice.items.map((item) => `<tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9">${item.description}<div style="font-size:11px;color:#94a3b8;margin-top:2px">${settings.currency}${item.unitPrice}/unit</div></td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${item.quantity}</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${fmt(item.quantity * item.unitPrice)}</td></tr>`).join("");
      const client = clients.find((c) => c.id === invoice.clientId);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${invoice.invoiceNumber}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1e293b;background:#fff;padding:48px}th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}table{width:100%;border-collapse:collapse}tr:last-child td{border-bottom:none!important}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:3px solid #3b82f6">
  <div>${logoHtml}<div style="font-size:24px;font-weight:800;color:#1e293b">${cName}</div>${companyProfile.tagline ? `<div style="font-size:13px;color:#64748b;margin-top:4px">${companyProfile.tagline}</div>` : ""}${hasAddr ? `<div style="font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.6">${[companyProfile.addressLine1, companyProfile.city && companyProfile.province ? `${companyProfile.city}, ${companyProfile.province}` : companyProfile.city, companyProfile.phone, companyProfile.email, companyProfile.vatNumber ? `VAT: ${companyProfile.vatNumber}` : ""].filter(Boolean).join("<br/>")}</div>` : ""}</div>
  <div style="text-align:right"><div style="font-size:28px;font-weight:800;color:#3b82f6">INVOICE</div><div style="font-size:16px;font-weight:600;margin-top:4px">${invoice.invoiceNumber}</div><div style="font-size:12px;color:#94a3b8;margin-top:8px">Issued: ${formatDate(invoice.createdAt)}</div><div style="font-size:12px;color:${invoice.status === "overdue" ? "#ef4444" : "#94a3b8"};margin-top:4px">Due: ${formatDate(invoice.dueDate)}</div></div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px">
  <div><div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">BILL TO</div><div style="font-size:15px;font-weight:700">${client?.name || "Client"}</div>${client?.company ? `<div style="color:#64748b;font-size:13px;margin-top:4px">${client.company}</div>` : ""}${client?.email ? `<div style="color:#64748b;font-size:13px;margin-top:2px">${client.email}</div>` : ""}${client?.phone ? `<div style="color:#64748b;font-size:13px;margin-top:2px">${client.phone}</div>` : ""}</div>
  <div style="text-align:right"><div style="display:inline-block;background:${invoice.status === "paid" ? "#f0fdf4" : invoice.status === "overdue" ? "#fef2f2" : "#f8fafc"};color:${invoice.status === "paid" ? "#10b981" : invoice.status === "overdue" ? "#ef4444" : "#64748b"};border:1px solid currentColor;border-radius:20px;padding:4px 14px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${invoice.status}</div></div>
</div>
${invoice.title ? `<div style="font-size:16px;font-weight:600;margin-bottom:16px">${invoice.title}</div>` : ""}
<table style="margin-bottom:24px"><thead><tr><th style="width:60%">Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead><tbody>${itemRows}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:24px"><div style="width:300px"><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:#64748b">Subtotal</span><span>${fmt(sub)}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="color:#64748b">Tax (${invoice.taxPercent}%)</span><span>${fmt(taxAmt)}</span></div><div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #1e293b;margin-top:4px"><span style="font-weight:700;text-transform:uppercase;letter-spacing:.5px">TOTAL DUE</span><span style="font-size:22px;font-weight:800;color:#3b82f6">${fmt(tot)}</span></div></div></div>
${invoice.notes ? `<div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px">NOTES</div><div style="font-size:13px;color:#64748b;line-height:1.6">${invoice.notes}</div></div>` : ""}
${(companyProfile.bankName || companyProfile.bankAccount) ? `<div style="background:#f0fdf4;border-radius:10px;padding:16px"><div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#064e3b;margin-bottom:8px">BANKING DETAILS</div>${companyProfile.bankName ? `<div style="font-size:13px;color:#065f46">Bank: ${companyProfile.bankName}</div>` : ""}${companyProfile.bankAccount ? `<div style="font-size:13px;color:#065f46">Account: ${companyProfile.bankAccount}</div>` : ""}${companyProfile.bankBranch ? `<div style="font-size:13px;color:#065f46">Branch: ${companyProfile.bankBranch}</div>` : ""}</div>` : ""}
<div style="margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between"><span>${cName}</span><span>Generated by HourLink</span></div>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${invoice.invoiceNumber}`, UTI: "com.adobe.pdf" });
    } catch (e) { console.error("PDF error", e); }
    finally { setExporting(false); }
  };

  const companyName = companyProfile.name || settings.name || "Your Company";
  const hasCompanyInfo = !!(companyProfile.name || companyProfile.addressLine1 || companyProfile.phone);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <AppIcon name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerNum, { color: colors.foreground }]}>{invoice.invoiceNumber}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: exporting ? colors.muted : colors.primary }]}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <AppIcon name="download-outline" size={15} color="#fff" />}
            <Text style={styles.exportBtnText}>{exporting ? "…" : "PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete}>
            <AppIcon name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: botPadding + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Row */}
        <View style={styles.statusRow}>
          <StatusBadge status={invoice.status} large />
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: colors.muted }]}
            onPress={() => setShowEdit(true)}
          >
            <AppIcon name="pencil" size={14} color={colors.mutedForeground} />
            <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Invoice Document Card */}
        <View style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Company Header */}
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
            {/* Invoice Meta */}
            <View style={styles.metaRow}>
              <View style={styles.metaBlock}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>INVOICE</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{invoice.invoiceNumber}</Text>
              </View>
              <View style={[styles.metaBlock, { alignItems: "flex-end" }]}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>ISSUE DATE</Text>
                <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatDate(invoice.createdAt)}</Text>
              </View>
            </View>
            <View style={[styles.metaRow, { marginTop: 8 }]}>
              <View style={styles.metaBlock} />
              <View style={[styles.metaBlock, { alignItems: "flex-end" }]}>
                <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>DUE DATE</Text>
                <Text style={[styles.metaValue, { color: invoice.status === "overdue" ? "#ef4444" : colors.foreground }]}>{formatDate(invoice.dueDate)}</Text>
              </View>
            </View>

            {/* From / To */}
            <View style={[styles.fromTo, { borderTopColor: colors.border }]}>
              <View style={styles.fromBlock}>
                <Text style={[styles.fromLabel, { color: colors.mutedForeground }]}>FROM</Text>
                <Text style={[styles.fromName, { color: colors.foreground }]}>{companyName}</Text>
                {hasCompanyInfo && (
                  <>
                    {companyProfile.addressLine1 ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.addressLine1}</Text> : null}
                    {companyProfile.city ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.city}, {companyProfile.province} {companyProfile.postalCode}</Text> : null}
                    {companyProfile.phone ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.phone}</Text> : null}
                    {companyProfile.email ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{companyProfile.email}</Text> : null}
                    {companyProfile.vatNumber ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>VAT: {companyProfile.vatNumber}</Text> : null}
                  </>
                )}
              </View>
              <View style={styles.fromBlock}>
                <Text style={[styles.fromLabel, { color: colors.mutedForeground }]}>BILL TO</Text>
                <Text style={[styles.fromName, { color: colors.foreground }]}>{client?.name || "Client"}</Text>
                {client?.company ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{client.company}</Text> : null}
                {client?.email ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{client.email}</Text> : null}
                {client?.phone ? <Text style={[styles.fromAddr, { color: colors.mutedForeground }]}>{client.phone}</Text> : null}
              </View>
            </View>

            {/* Title */}
            {invoice.title ? <Text style={[styles.invoiceTitle, { color: colors.foreground }]}>{invoice.title}</Text> : null}

            {/* Line Items */}
            <View style={[styles.lineTable, { borderColor: colors.border }]}>
              <View style={[styles.lineHeader, { backgroundColor: colors.muted }]}>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 3 }]}>Description</Text>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 1, textAlign: "center" }]}>Qty</Text>
                <Text style={[styles.lineHeaderText, { color: colors.mutedForeground, flex: 1.5, textAlign: "right" }]}>Amount</Text>
              </View>
              {invoice.items.map((item, idx) => (
                <View key={item.id} style={[styles.lineRow, idx < invoice.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={{ flex: 3 }}>
                    <Text style={[styles.lineDesc, { color: colors.foreground }]}>{item.description}</Text>
                    <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>{settings.currency}{item.unitPrice}/unit</Text>
                  </View>
                  <Text style={[styles.lineQty, { color: colors.mutedForeground, flex: 1, textAlign: "center" }]}>{item.quantity}</Text>
                  <Text style={[styles.lineAmt, { color: colors.foreground, flex: 1.5, textAlign: "right" }]}>
                    {settings.currency}{(item.quantity * item.unitPrice).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.totalsBlock}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{settings.currency}{subtotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Tax ({invoice.taxPercent}%)</Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>{settings.currency}{tax.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.totalRow, styles.grandRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.grandLabel, { color: colors.foreground }]}>TOTAL DUE</Text>
                <Text style={[styles.grandAmount, { color: colors.primary }]}>{settings.currency}{total.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* Notes */}
            {invoice.notes ? (
              <View style={[styles.notesBlock, { borderTopColor: colors.border }]}>
                <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>NOTES</Text>
                <Text style={[styles.notesText, { color: colors.mutedForeground }]}>{invoice.notes}</Text>
              </View>
            ) : null}

            {/* Banking Details */}
            {(companyProfile.bankName || companyProfile.bankAccount) && (
              <View style={[styles.bankBlock, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                <Text style={[styles.bankTitle, { color: colors.foreground }]}>Banking Details</Text>
                {companyProfile.bankName ? <Text style={[styles.bankRow, { color: colors.mutedForeground }]}>Bank: {companyProfile.bankName}</Text> : null}
                {companyProfile.bankAccount ? <Text style={[styles.bankRow, { color: colors.mutedForeground }]}>Account: {companyProfile.bankAccount}</Text> : null}
                {companyProfile.bankBranch ? <Text style={[styles.bankRow, { color: colors.mutedForeground }]}>Branch: {companyProfile.bankBranch}</Text> : null}
              </View>
            )}
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
        </View>
      </ScrollView>

      <BottomSheet visible={showEdit} onClose={() => setShowEdit(false)} title="Edit Invoice">
        <FormField label="Notes" placeholder="Payment terms, instructions..." value={editNotes} onChangeText={setEditNotes} multiline numberOfLines={4} />
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerNum: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  exportBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  docCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 20 },
  companyHeader: { padding: 20, borderBottomWidth: 1, gap: 10 },
  companyLogo: { width: "100%" as any, height: 140 },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  companySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaBlock: { flex: 1 },
  metaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  metaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  fromTo: { flexDirection: "row", gap: 20, borderTopWidth: 1, paddingTop: 20, marginTop: 20, marginBottom: 20 },
  fromBlock: { flex: 1 },
  fromLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  fromName: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  fromAddr: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  invoiceTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  lineTable: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  lineHeader: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10 },
  lineHeaderText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  lineRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  lineDesc: { fontSize: 13, fontFamily: "Inter_500Medium" },
  lineSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  lineQty: { fontSize: 13, fontFamily: "Inter_400Regular" },
  lineAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  totalsBlock: { alignItems: "flex-end", gap: 6, marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: "55%" },
  totalLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
  grandRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 4, width: "100%" },
  grandLabel: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
  grandAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  notesBlock: { borderTopWidth: 1, paddingTop: 16, marginTop: 8 },
  notesLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  notesText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bankBlock: { borderTopWidth: 1, marginTop: 16, padding: 14, borderRadius: 10 },
  bankTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  bankRow: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  actions: { gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  actionBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
