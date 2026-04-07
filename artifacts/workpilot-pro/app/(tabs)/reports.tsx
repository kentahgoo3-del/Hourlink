import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClientBadge } from "@/components/ClientBadge";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Period = "week" | "month" | "quarter" | "year";

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

function getPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") { const d = new Date(now); d.setDate(now.getDate() - 7); return d; }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return new Date(now.getFullYear(), q * 3, 1); }
  return new Date(now.getFullYear(), 0, 1);
}

function getPrevPeriodStart(period: Period): Date {
  const now = new Date();
  if (period === "week") { const d = new Date(now); d.setDate(now.getDate() - 14); return d; }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (period === "quarter") { const q = Math.floor(now.getMonth() / 3); return new Date(now.getFullYear(), (q - 1) * 3, 1); }
  return new Date(now.getFullYear() - 1, 0, 1);
}

function getDayKey(iso: string) {
  return iso.split("T")[0];
}

function getMiniLabel(dateStr: string, period: Period) {
  const [, m, d] = dateStr.split("-");
  if (period === "year") return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]}`;
  return `${d}/${m}`;
}

function MiniBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.min(100, percent * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function Insight({ icon, text, color }: { icon: string; text: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.insight, { backgroundColor: color + "14", borderColor: color + "40" }]}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[styles.insightText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  formatValue: (v: number) => string;
  maxBars?: number;
}

function VerticalBarChart({ data, color, formatValue, maxBars = 14 }: BarChartProps) {
  const colors = useColors();
  const displayed = data.slice(-maxBars);
  const maxVal = Math.max(1, ...displayed.map((d) => d.value));
  const barW = Math.max(16, Math.floor(300 / Math.max(displayed.length, 1)) - 4);

  if (displayed.every((d) => d.value === 0)) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={[styles.chartEmptyText, { color: colors.mutedForeground }]}>No data for this period</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chartInner}>
          {displayed.map((item, idx) => {
            const pct = item.value / maxVal;
            const isActive = item.value > 0;
            return (
              <View key={idx} style={[styles.barGroup, { width: barW + 8 }]}>
                <Text style={[styles.barTopLabel, { color: isActive ? colors.foreground : "transparent" }]} numberOfLines={1}>
                  {isActive ? formatValue(item.value) : ""}
                </Text>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.vertBar,
                      {
                        height: `${Math.max(4, pct * 100)}%` as any,
                        width: barW,
                        backgroundColor: isActive ? color : colors.muted,
                        borderRadius: 4,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barBottomLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { clients, timeEntries, invoices, expenses, settings, tasks, companyProfile } = useApp();
  const [period, setPeriod] = useState<Period>("month");
  const [exporting, setExporting] = useState(false);

  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const prevStart = useMemo(() => getPrevPeriodStart(period), [period]);
  const prevEnd = useMemo(() => getPeriodStart(period), [period]);

  const periodEntries = useMemo(() => timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= periodStart), [timeEntries, periodStart]);
  const prevEntries = useMemo(() => timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= prevStart && new Date(e.startTime) < prevEnd), [timeEntries, prevStart, prevEnd]);

  const periodInvoices = useMemo(() => invoices.filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= periodStart), [invoices, periodStart]);
  const prevInvoices = useMemo(() => invoices.filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= prevStart && new Date(inv.paidAt || inv.createdAt) < prevEnd), [invoices, prevStart, prevEnd]);

  const totalSeconds = useMemo(() => periodEntries.reduce((s, e) => s + e.durationSeconds, 0), [periodEntries]);
  const prevSeconds = useMemo(() => prevEntries.reduce((s, e) => s + e.durationSeconds, 0), [prevEntries]);
  const billableSeconds = useMemo(() => periodEntries.filter((e) => e.billable).reduce((s, e) => s + e.durationSeconds, 0), [periodEntries]);

  const calcRev = (invs: typeof invoices) => invs.reduce((sum, inv) => {
    const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
    return sum + sub * (1 + inv.taxPercent / 100);
  }, 0);

  const totalRevenue = useMemo(() => calcRev(periodInvoices), [periodInvoices]);
  const prevRevenue = useMemo(() => calcRev(prevInvoices), [prevInvoices]);

  const totalExpenses = useMemo(() => expenses.filter((e) => new Date(e.date) >= periodStart).reduce((s, e) => s + e.amount, 0), [expenses, periodStart]);
  const netProfit = totalRevenue - totalExpenses;

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const hoursChange = prevSeconds > 0 ? ((totalSeconds - prevSeconds) / prevSeconds) * 100 : 0;

  const avgHourlyRate = useMemo(() => {
    const billHours = billableSeconds / 3600;
    if (billHours === 0) return 0;
    const totalEarnable = periodEntries.filter((e) => e.billable).reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0);
    return totalEarnable / billHours;
  }, [periodEntries, billableSeconds]);

  const clientBreakdown = useMemo(() => {
    const map = new Map<string, { seconds: number; earned: number }>();
    for (const e of periodEntries) {
      const cur = map.get(e.clientId) || { seconds: 0, earned: 0 };
      cur.seconds += e.durationSeconds;
      if (e.billable) cur.earned += (e.durationSeconds / 3600) * e.hourlyRate;
      map.set(e.clientId, cur);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data, client: clients.find((c) => c.id === id) }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [periodEntries, clients]);

  const maxSeconds = Math.max(1, ...clientBreakdown.map((c) => c.seconds));

  const insights: Array<{ icon: string; text: string; color: string }> = useMemo(() => {
    const list: Array<{ icon: string; text: string; color: string }> = [];
    if (revenueChange > 10) list.push({ icon: "📈", text: `Revenue up ${revenueChange.toFixed(0)}% vs last ${period}`, color: "#10b981" });
    if (revenueChange < -10) list.push({ icon: "📉", text: `Revenue down ${Math.abs(revenueChange).toFixed(0)}% vs last ${period}`, color: "#ef4444" });
    if (billableSeconds > 0 && totalSeconds > 0) {
      const util = billableSeconds / totalSeconds;
      if (util > 0.85) list.push({ icon: "🔥", text: `${Math.round(util * 100)}% utilization — excellent!`, color: "#f59e0b" });
      if (util < 0.5) list.push({ icon: "⚠️", text: `Only ${Math.round(util * 100)}% of hours are billable`, color: "#f59e0b" });
    }
    if (avgHourlyRate > 0 && settings.defaultHourlyRate > 0) {
      if (avgHourlyRate > settings.defaultHourlyRate * 1.1) {
        list.push({ icon: "💰", text: `Blended rate ${settings.currency}${avgHourlyRate.toFixed(0)}/h — above default`, color: "#10b981" });
      }
    }
    if (clientBreakdown.length > 0) {
      const top = clientBreakdown[0];
      if (top.client) list.push({ icon: "⭐", text: `${top.client.name} is your busiest client (${formatHours(top.seconds)})`, color: "#3b82f6" });
    }
    const unpaidCount = invoices.filter((inv) => inv.status === "overdue").length;
    if (unpaidCount > 0) list.push({ icon: "🚨", text: `${unpaidCount} overdue invoice${unpaidCount > 1 ? "s" : ""} need attention`, color: "#ef4444" });
    if (totalExpenses > 0) list.push({ icon: "🧾", text: `Net profit: ${formatCurrency(netProfit, settings.currency)} after expenses`, color: netProfit > 0 ? "#10b981" : "#ef4444" });
    return list.slice(0, 4);
  }, [revenueChange, billableSeconds, totalSeconds, avgHourlyRate, clientBreakdown, invoices, totalExpenses]);

  const taskBreakdown = useMemo(() => {
    const map = new Map<string, { seconds: number; earned: number; taskTitle: string; rate: number }>();
    for (const e of periodEntries) {
      if (!e.taskId) continue;
      const task = tasks.find((t) => t.id === e.taskId);
      const cur = map.get(e.taskId) || { seconds: 0, earned: 0, taskTitle: task?.title || "Unknown task", rate: e.hourlyRate };
      cur.seconds += e.durationSeconds;
      if (e.billable) cur.earned += (e.durationSeconds / 3600) * e.hourlyRate;
      map.set(e.taskId, cur);
    }
    return Array.from(map.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [periodEntries, tasks]);

  const maxTaskSeconds = Math.max(1, ...taskBreakdown.map((t) => t.seconds));

  const invoiceStatus = useMemo(() => {
    const all = invoices.filter((inv) => new Date(inv.createdAt) >= periodStart);
    return {
      total: all.length,
      paid: all.filter((inv) => inv.status === "paid").length,
      sent: all.filter((inv) => inv.status === "sent").length,
      overdue: all.filter((inv) => inv.status === "overdue").length,
      draft: all.filter((inv) => inv.status === "draft").length,
    };
  }, [invoices, periodStart]);

  const dailyHoursData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of periodEntries) {
      const key = getDayKey(e.startTime);
      map.set(key, (map.get(key) || 0) + e.durationSeconds);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([key, secs]) => ({
      label: getMiniLabel(key, period),
      value: parseFloat((secs / 3600).toFixed(2)),
    }));
  }, [periodEntries, period]);

  const dailyRevenueData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of periodInvoices) {
      const key = getDayKey(inv.paidAt || inv.createdAt);
      const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      const total = sub * (1 + inv.taxPercent / 100);
      map.set(key, (map.get(key) || 0) + total);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([key, amount]) => ({
      label: getMiniLabel(key, period),
      value: Math.round(amount),
    }));
  }, [periodInvoices, period]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const changeColor = (pct: number) => pct >= 0 ? "#10b981" : "#ef4444";
  const changePrefix = (pct: number) => pct >= 0 ? "+" : "";

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
      const now = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
      const utilPct = totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0;

      const clientRows = clientBreakdown.map((item) => `
        <tr>
          <td>${item.client?.name || "Unknown"}</td>
          <td>${formatHours(item.seconds)}</td>
          <td>${formatCurrency(item.earned, settings.currency)}</td>
        </tr>`).join("");

      const taskRows = taskBreakdown.map((item) => `
        <tr>
          <td>${item.taskTitle}</td>
          <td>${formatHours(item.seconds)}</td>
          <td>${formatCurrency(item.earned, settings.currency)}</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${companyProfile.name || "WorkPilot Pro"} — ${periodLabel} Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #3b82f6; padding-bottom: 24px; }
    .company-name { font-size: 26px; font-weight: 800; color: #1e293b; }
    .report-title { font-size: 14px; color: #64748b; margin-top: 4px; }
    .date { font-size: 12px; color: #94a3b8; text-align: right; }
    .section-title { font-size: 14px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin: 32px 0 12px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 8px; }
    .kpi { background: #f8fafc; border-radius: 12px; padding: 16px; }
    .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .kpi-value { font-size: 22px; font-weight: 800; color: #1e293b; }
    .kpi-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
    tr:last-child td { border-bottom: none; }
    .insight { background: #f0fdf4; border-left: 3px solid #10b981; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; color: #065f46; border-radius: 0 8px 8px 0; }
    .bar-chart { display: flex; align-items: flex-end; gap: 4px; height: 80px; margin: 12px 0; }
    .bar-item { display: flex; flex-direction: column; align-items: center; flex: 1; }
    .bar-fill { width: 100%; background: #3b82f6; border-radius: 3px 3px 0 0; min-height: 2px; }
    .bar-label { font-size: 8px; color: #94a3b8; margin-top: 3px; }
    .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    .profit-positive { color: #10b981; }
    .profit-negative { color: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${companyProfile.name || "WorkPilot Pro"}</div>
      <div class="report-title">${periodLabel} Performance Report</div>
    </div>
    <div class="date">Generated ${now}</div>
  </div>

  <div class="section-title">Key Metrics</div>
  <div class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Revenue</div>
      <div class="kpi-value">${formatCurrency(totalRevenue, settings.currency)}</div>
      ${prevRevenue > 0 ? `<div class="kpi-sub">${changePrefix(revenueChange)}${revenueChange.toFixed(0)}% vs prev ${period}</div>` : ""}
    </div>
    <div class="kpi">
      <div class="kpi-label">Net Profit</div>
      <div class="kpi-value ${netProfit >= 0 ? "profit-positive" : "profit-negative"}">${formatCurrency(netProfit, settings.currency)}</div>
      ${totalExpenses > 0 ? `<div class="kpi-sub">${formatCurrency(totalExpenses, settings.currency)} expenses</div>` : ""}
    </div>
    <div class="kpi">
      <div class="kpi-label">Hours Tracked</div>
      <div class="kpi-value">${formatHours(totalSeconds)}</div>
      <div class="kpi-sub">${formatHours(billableSeconds)} billable</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Utilization</div>
      <div class="kpi-value">${utilPct}%</div>
      ${avgHourlyRate > 0 ? `<div class="kpi-sub">${settings.currency}${avgHourlyRate.toFixed(0)}/h avg rate</div>` : ""}
    </div>
  </div>

  ${clientBreakdown.length > 0 ? `
  <div class="section-title">Hours by Client</div>
  <table>
    <thead><tr><th>Client</th><th>Hours</th><th>Earned</th></tr></thead>
    <tbody>${clientRows}</tbody>
  </table>` : ""}

  ${taskBreakdown.length > 0 ? `
  <div class="section-title">Hours by Task</div>
  <table>
    <thead><tr><th>Task</th><th>Hours</th><th>Earned</th></tr></thead>
    <tbody>${taskRows}</tbody>
  </table>` : ""}

  ${invoiceStatus.total > 0 ? `
  <div class="section-title">Invoice Summary</div>
  <table>
    <thead><tr><th>Status</th><th>Count</th></tr></thead>
    <tbody>
      <tr><td>Paid</td><td>${invoiceStatus.paid}</td></tr>
      <tr><td>Sent / Awaiting</td><td>${invoiceStatus.sent}</td></tr>
      <tr><td>Overdue</td><td>${invoiceStatus.overdue}</td></tr>
      <tr><td>Draft</td><td>${invoiceStatus.draft}</td></tr>
    </tbody>
  </table>` : ""}

  ${insights.length > 0 ? `
  <div class="section-title">Insights</div>
  ${insights.map((ins) => `<div class="insight">${ins.icon} ${ins.text}</div>`).join("")}` : ""}

  <div class="footer">
    <span>${companyProfile.name || "WorkPilot Pro"}</span>
    <span>WorkPilot Pro · ${periodLabel} Report · ${now}</span>
  </div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${periodLabel} Report`, UTI: "com.adobe.pdf" });
    } catch (e) {
      console.error("PDF export error", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: botPadding + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Reports</Text>
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: exporting ? colors.muted : colors.primary }]}
          onPress={handleExportPDF}
          disabled={exporting}
          testID="export-pdf-btn"
        >
          {exporting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="document-outline" size={16} color="#fff" />
          }
          <Text style={styles.exportBtnText}>{exporting ? "Generating…" : "Export PDF"}</Text>
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={[styles.periodRow, { backgroundColor: colors.muted }]}>
        {(["week", "month", "quarter", "year"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && { backgroundColor: colors.primary }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodLabel, { color: period === p ? "#fff" : colors.mutedForeground }]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Insights */}
      {insights.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Insights</Text>
          {insights.map((ins, idx) => <Insight key={idx} {...ins} />)}
        </>
      )}

      {/* Summary Cards */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Summary</Text>
      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryLabel}>Revenue</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalRevenue, settings.currency)}</Text>
          {prevRevenue > 0 && (
            <Text style={[styles.summaryChange, { color: revenueChange >= 0 ? "#a7f3d0" : "#fca5a5" }]}>
              {changePrefix(revenueChange)}{revenueChange.toFixed(0)}% vs prev {period}
            </Text>
          )}
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Net Profit</Text>
          <Text style={[styles.summaryValue, { color: netProfit >= 0 ? "#10b981" : "#ef4444" }]}>{formatCurrency(netProfit, settings.currency)}</Text>
          {totalExpenses > 0 && <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>{formatCurrency(totalExpenses, settings.currency)} expenses</Text>}
        </View>
      </View>
      <View style={[styles.summaryGrid, { marginTop: 10 }]}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Hours</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatHours(totalSeconds)}</Text>
          {prevSeconds > 0 && (
            <Text style={[styles.summaryChange, { color: changeColor(hoursChange) }]}>
              {changePrefix(hoursChange)}{hoursChange.toFixed(0)}% vs prev
            </Text>
          )}
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Utilization</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>
            {totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0}%
          </Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>{formatHours(billableSeconds)} billable</Text>
        </View>
      </View>

      {/* Daily Hours Bar Chart */}
      {dailyHoursData.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours per Day</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart
              data={dailyHoursData}
              color={colors.primary}
              formatValue={(v) => `${v.toFixed(1)}h`}
            />
          </View>
        </>
      )}

      {/* Daily Revenue Bar Chart */}
      {dailyRevenueData.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue per Day</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart
              data={dailyRevenueData}
              color="#10b981"
              formatValue={(v) => `${settings.currency}${v}`}
            />
          </View>
        </>
      )}

      {/* Client Hours Bar Chart */}
      {clientBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours by Client</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart
              data={clientBreakdown.map((item) => ({ label: item.client?.name?.split(" ")[0] || "?", value: parseFloat((item.seconds / 3600).toFixed(2)) }))}
              color="#f59e0b"
              formatValue={(v) => `${v.toFixed(1)}h`}
            />
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10 }]}>
            {clientBreakdown.map((item, idx) => (
              <View key={item.id} style={[styles.clientRow, idx < clientBreakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                {item.client && <ClientBadge name={item.client.name} color={item.client.color} size="sm" />}
                <View style={styles.clientMid}>
                  <View style={styles.clientNameRow}>
                    <Text style={[styles.clientName, { color: colors.foreground }]}>{item.client?.name || "Unknown"}</Text>
                    <Text style={[styles.clientHours, { color: colors.foreground }]}>{formatHours(item.seconds)}</Text>
                  </View>
                  <MiniBar percent={item.seconds / maxSeconds} color={item.client?.color || colors.primary} />
                  <Text style={[styles.clientEarned, { color: colors.mutedForeground }]}>{formatCurrency(item.earned, settings.currency)} earned</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Task Hours Breakdown */}
      {taskBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours by Task</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {taskBreakdown.map((item, idx) => (
              <View key={item.id} style={[styles.clientRow, idx < taskBreakdown.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.taskDot, { backgroundColor: colors.primary }]} />
                <View style={styles.clientMid}>
                  <View style={styles.clientNameRow}>
                    <Text style={[styles.clientName, { color: colors.foreground }]} numberOfLines={1}>{item.taskTitle}</Text>
                    <Text style={[styles.clientHours, { color: colors.foreground }]}>{formatHours(item.seconds)}</Text>
                  </View>
                  <MiniBar percent={item.seconds / maxTaskSeconds} color={colors.primary} />
                  <View style={styles.taskMetaRow}>
                    <Text style={[styles.clientEarned, { color: colors.mutedForeground }]}>{formatCurrency(item.earned, settings.currency)} earned</Text>
                    <Text style={[styles.clientEarned, { color: colors.mutedForeground }]}>{settings.currency}{item.rate}/h</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Invoice Status */}
      {invoiceStatus.total > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Invoice Status</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "Paid", count: invoiceStatus.paid, color: "#10b981" },
              { label: "Sent", count: invoiceStatus.sent, color: "#3b82f6" },
              { label: "Overdue", count: invoiceStatus.overdue, color: "#ef4444" },
              { label: "Draft", count: invoiceStatus.draft, color: "#94a3b8" },
            ].map((row, idx) => (
              <View key={row.label} style={[styles.statusRow, idx < 3 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.statusDot, { backgroundColor: row.color }]} />
                <Text style={[styles.statusLabel, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={[styles.statusCount, { color: colors.foreground }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {totalSeconds === 0 && totalRevenue === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Start tracking time and sending invoices to see your reports.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  exportBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  periodRow: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 20 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  periodLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 24, marginBottom: 12 },
  insight: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  insightText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 16 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  summarySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  summaryChange: { fontSize: 12, fontFamily: "Inter_500Medium" },
  chartCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 4 },
  chartWrap: { width: "100%" },
  chartInner: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 120, paddingBottom: 20 },
  chartEmpty: { height: 80, alignItems: "center", justifyContent: "center" },
  chartEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  barGroup: { alignItems: "center", height: "100%" },
  barContainer: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  vertBar: { borderRadius: 4 },
  barTopLabel: { fontSize: 9, fontFamily: "Inter_500Medium", marginBottom: 2, textAlign: "center" },
  barBottomLabel: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  clientMid: { flex: 1 },
  clientNameRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  clientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientHours: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  clientEarned: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  taskDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  taskMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: "#e2e8f0", overflow: "hidden" },
  barFill: { height: 4, borderRadius: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  statusCount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
