import { AppIcon } from "@/components/AppIcon";
import * as FileSystem from "expo-file-system";
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

function formatCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatHours(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

interface PeriodBounds {
  start: Date;
  end: Date;
  label: string;
  sublabel: string;
}

function getPeriodBounds(period: Period, offset: number): PeriodBounds {
  const now = new Date();

  if (period === "week") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const sameMonth = monday.getMonth() === sunday.getMonth() && monday.getFullYear() === sunday.getFullYear();
    const label = sameMonth
      ? `${monday.getDate()} – ${sunday.getDate()} ${sunday.toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}`
      : `${monday.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`;
    const sublabel = offset === 0 ? "This week" : offset === -1 ? "Last week" : `${Math.abs(offset)} weeks ago`;
    return { start: monday, end: sunday, label, sublabel };
  }

  if (period === "month") {
    const baseYear = now.getFullYear();
    const baseMonth = now.getMonth() + offset;
    const start = new Date(baseYear, baseMonth, 1);
    const end = new Date(baseYear, baseMonth + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
    const fullRange = `1 – ${end.getDate()} ${start.toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}`;
    const sublabel = offset === 0 ? "This month" : offset === -1 ? "Last month" : `${Math.abs(offset)} months ago`;
    return { start, end, label: monthName, sublabel };
  }

  if (period === "quarter") {
    const baseQ = Math.floor(now.getMonth() / 3) + offset;
    const yearAdj = Math.floor(baseQ / 4);
    const qNorm = ((baseQ % 4) + 4) % 4;
    const qYear = now.getFullYear() + yearAdj;
    const start = new Date(qYear, qNorm * 3, 1);
    const end = new Date(qYear, qNorm * 3 + 3, 0, 23, 59, 59, 999);
    const label = `Q${qNorm + 1} ${qYear}`;
    const sublabel = offset === 0 ? "This quarter" : offset === -1 ? "Last quarter" : `${Math.abs(offset)} quarters ago`;
    return { start, end, label, sublabel };
  }

  const year = now.getFullYear() + offset;
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const sublabel = offset === 0 ? "This year" : offset === -1 ? "Last year" : `${year}`;
  return { start, end, label: `${year}`, sublabel };
}

function getDayKey(iso: string) { return iso.split("T")[0]; }

function getMiniLabel(dateStr: string, period: Period) {
  const [, m, d] = dateStr.split("-");
  if (period === "year") return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1];
  if (period === "quarter") return `${d}/${m}`;
  return `${parseInt(d)}/${parseInt(m)}`;
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
                  <View style={[styles.vertBar, { height: `${Math.max(4, pct * 100)}%` as any, width: barW, backgroundColor: isActive ? color : colors.muted, borderRadius: 4 }]} />
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
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  const bounds = useMemo(() => getPeriodBounds(period, offset), [period, offset]);
  const prevBounds = useMemo(() => getPeriodBounds(period, offset - 1), [period, offset]);

  const handlePeriodChange = (p: Period) => { setPeriod(p); setOffset(0); };

  const periodEntries = useMemo(() =>
    timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= bounds.start && new Date(e.startTime) <= bounds.end),
    [timeEntries, bounds]);

  const prevEntries = useMemo(() =>
    timeEntries.filter((e) => e.endTime && new Date(e.startTime) >= prevBounds.start && new Date(e.startTime) <= prevBounds.end),
    [timeEntries, prevBounds]);

  const periodInvoices = useMemo(() =>
    invoices.filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= bounds.start && new Date(inv.paidAt || inv.createdAt) <= bounds.end),
    [invoices, bounds]);

  const prevInvoices = useMemo(() =>
    invoices.filter((inv) => inv.status === "paid" && new Date(inv.paidAt || inv.createdAt) >= prevBounds.start && new Date(inv.paidAt || inv.createdAt) <= prevBounds.end),
    [invoices, prevBounds]);

  const totalSeconds = useMemo(() => periodEntries.reduce((s, e) => s + e.durationSeconds, 0), [periodEntries]);
  const prevSeconds = useMemo(() => prevEntries.reduce((s, e) => s + e.durationSeconds, 0), [prevEntries]);
  const billableSeconds = useMemo(() => periodEntries.filter((e) => e.billable).reduce((s, e) => s + e.durationSeconds, 0), [periodEntries]);

  const calcRev = (invs: typeof invoices) =>
    invs.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0) * (1 + inv.taxPercent / 100), 0);

  const totalRevenue = useMemo(() => calcRev(periodInvoices), [periodInvoices]);
  const prevRevenue = useMemo(() => calcRev(prevInvoices), [prevInvoices]);
  const totalExpenses = useMemo(() => expenses.filter((e) => new Date(e.date) >= bounds.start && new Date(e.date) <= bounds.end).reduce((s, e) => s + e.amount, 0), [expenses, bounds]);
  const netProfit = totalRevenue - totalExpenses;

  const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const hoursChange = prevSeconds > 0 ? ((totalSeconds - prevSeconds) / prevSeconds) * 100 : 0;

  const avgHourlyRate = useMemo(() => {
    const billHours = billableSeconds / 3600;
    if (billHours === 0) return 0;
    return periodEntries.filter((e) => e.billable).reduce((s, e) => s + (e.durationSeconds / 3600) * e.hourlyRate, 0) / billHours;
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

  const insights = useMemo(() => {
    const list: Array<{ icon: string; text: string; color: string }> = [];
    if (revenueChange > 10) list.push({ icon: "📈", text: `Revenue up ${revenueChange.toFixed(0)}% vs prev ${period}`, color: "#10b981" });
    if (revenueChange < -10) list.push({ icon: "📉", text: `Revenue down ${Math.abs(revenueChange).toFixed(0)}% vs prev ${period}`, color: "#ef4444" });
    if (billableSeconds > 0 && totalSeconds > 0) {
      const util = billableSeconds / totalSeconds;
      if (util > 0.85) list.push({ icon: "🔥", text: `${Math.round(util * 100)}% utilization — excellent!`, color: "#f59e0b" });
      if (util < 0.5) list.push({ icon: "⚠️", text: `Only ${Math.round(util * 100)}% of hours are billable`, color: "#f59e0b" });
    }
    if (avgHourlyRate > 0 && settings.defaultHourlyRate > 0 && avgHourlyRate > settings.defaultHourlyRate * 1.1) {
      list.push({ icon: "💰", text: `Blended rate ${settings.currency}${avgHourlyRate.toFixed(0)}/h — above default`, color: "#10b981" });
    }
    if (clientBreakdown.length > 0 && clientBreakdown[0].client) {
      list.push({ icon: "⭐", text: `${clientBreakdown[0].client.name} is your top client (${formatHours(clientBreakdown[0].seconds)})`, color: "#3b82f6" });
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
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.seconds - a.seconds);
  }, [periodEntries, tasks]);

  const maxTaskSeconds = Math.max(1, ...taskBreakdown.map((t) => t.seconds));

  const invoiceStatus = useMemo(() => {
    const all = invoices.filter((inv) => new Date(inv.createdAt) >= bounds.start && new Date(inv.createdAt) <= bounds.end);
    return {
      total: all.length,
      paid: all.filter((inv) => inv.status === "paid").length,
      sent: all.filter((inv) => inv.status === "sent").length,
      overdue: all.filter((inv) => inv.status === "overdue").length,
      draft: all.filter((inv) => inv.status === "draft").length,
    };
  }, [invoices, bounds]);

  const dailyHoursData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of periodEntries) {
      const key = getDayKey(e.startTime);
      map.set(key, (map.get(key) || 0) + e.durationSeconds);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, secs]) => ({ label: getMiniLabel(key, period), value: parseFloat((secs / 3600).toFixed(2)) }));
  }, [periodEntries, period]);

  const dailyRevenueData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of periodInvoices) {
      const key = getDayKey(inv.paidAt || inv.createdAt);
      const sub = inv.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      map.set(key, (map.get(key) || 0) + sub * (1 + inv.taxPercent / 100));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, amount]) => ({ label: getMiniLabel(key, period), value: Math.round(amount) }));
  }, [periodInvoices, period]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const botPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const changeColor = (pct: number) => pct >= 0 ? "#10b981" : "#ef4444";
  const changePrefix = (pct: number) => pct >= 0 ? "+" : "";

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const now = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
      const utilPct = totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 100) : 0;
      const logoDataUri = await getLogoDataUri((companyProfile as any).logoUri);
      const companyName = companyProfile.name || "HourLink";
      const maxDailyHours = Math.max(1, ...dailyHoursData.map((d) => d.value));
      const maxDailyRev = Math.max(1, ...dailyRevenueData.map((d) => d.value));
      const maxClientSec = Math.max(1, ...clientBreakdown.map((c) => c.seconds));
      const totalClientSec = clientBreakdown.reduce((s, c) => s + c.seconds, 0) || 1;
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${companyName} — ${bounds.label} Report</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica Neue, Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; line-height: 1.5; width: 794px; max-width: 794px; margin: 0 auto; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center; padding: 0 0 18px; border-bottom: 3px solid #3b82f6; margin-bottom: 24px; }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .logo-wrap img { max-height: 56px; max-width: 140px; object-fit: contain; display: block; }
  .company-name { font-size: 22px; font-weight: 800; color: #0f172a; }
  .report-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
  .report-meta span { color: #3b82f6; font-weight: 600; }
  .header-right { text-align: right; }
  .gen-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.6px; }
  .gen-date { font-size: 12px; color: #334155; font-weight: 600; margin-top: 2px; }

  /* Section */
  .section-title { font-size: 9px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.2px; margin: 24px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e2e8f0; }

  /* KPI Cards */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; page-break-inside: avoid; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .kpi-value { font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.1; }
  .kpi-value.green { color: #059669; }
  .kpi-value.red { color: #dc2626; }
  .kpi-sub { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .kpi-delta { font-size: 10px; font-weight: 700; margin-top: 4px; }
  .kpi-delta.up { color: #059669; }
  .kpi-delta.dn { color: #dc2626; }

  /* Tables */
  .table-wrap { page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { background: #1e293b; }
  th { padding: 8px 12px; text-align: left; font-size: 9px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
  th.r { text-align: right; }
  td { padding: 8px 12px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  td.r { text-align: right; font-weight: 600; color: #0f172a; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }

  /* Inline bar */
  .bar-cell { width: 120px; }
  .bar-bg { background: #e2e8f0; border-radius: 3px; height: 6px; width: 100%; overflow: hidden; }
  .bar-fill-blue { background: #3b82f6; height: 6px; border-radius: 3px; }
  .bar-fill-green { background: #10b981; height: 6px; border-radius: 3px; }

  /* Invoice status cards */
  .inv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; page-break-inside: avoid; }
  .inv-card { border-radius: 8px; padding: 12px 14px; }
  .inv-card.paid { background: #dcfce7; }
  .inv-card.sent { background: #dbeafe; }
  .inv-card.overdue { background: #fee2e2; }
  .inv-card.draft { background: #f1f5f9; }
  .inv-status { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .inv-card.paid .inv-status { color: #15803d; }
  .inv-card.sent .inv-status { color: #1d4ed8; }
  .inv-card.overdue .inv-status { color: #b91c1c; }
  .inv-card.draft .inv-status { color: #475569; }
  .inv-count { font-size: 28px; font-weight: 800; }
  .inv-card.paid .inv-count { color: #166534; }
  .inv-card.sent .inv-count { color: #1e40af; }
  .inv-card.overdue .inv-count { color: #991b1b; }
  .inv-card.draft .inv-count { color: #334155; }
  .inv-label { font-size: 10px; color: #64748b; margin-top: 2px; }

  /* Insights */
  .insights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; page-break-inside: avoid; }
  .insight { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; border-radius: 6px; padding: 9px 12px; display: flex; align-items: flex-start; gap: 8px; }
  .ins-icon { font-size: 13px; flex-shrink: 0; }
  .ins-text { font-size: 11px; color: #166534; line-height: 1.4; }

  /* Footer */
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .footer span { font-size: 10px; color: #94a3b8; }
  .footer strong { color: #3b82f6; }
</style>
</head>
<body>

<!-- ── Header ── -->
<div class="header">
  <div class="header-left">
    ${logoDataUri ? `<div class="logo-wrap"><img src="${logoDataUri}" alt=""/></div>` : ""}
    <div>
      <div class="company-name">${companyName}</div>
      <div class="report-meta"><span>${bounds.label}</span> &nbsp;·&nbsp; ${bounds.sublabel}</div>
    </div>
  </div>
  <div class="header-right">
    <div class="gen-label">Generated</div>
    <div class="gen-date">${now}</div>
  </div>
</div>

<!-- ── Summary KPIs ── -->
<div class="section-title">Summary</div>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Revenue</div>
    <div class="kpi-value">${formatCurrency(totalRevenue, settings.currency)}</div>
    ${prevRevenue > 0 ? `<div class="kpi-delta ${revenueChange >= 0 ? "up" : "dn"}">${changePrefix(revenueChange)}${revenueChange.toFixed(0)}% vs prev ${period}</div>` : `<div class="kpi-sub">No prior period</div>`}
  </div>
  <div class="kpi">
    <div class="kpi-label">Net Profit</div>
    <div class="kpi-value ${netProfit >= 0 ? "green" : "red"}">${formatCurrency(netProfit, settings.currency)}</div>
    <div class="kpi-sub">${totalExpenses > 0 ? `${formatCurrency(totalExpenses, settings.currency)} expenses` : "No expenses recorded"}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Total Hours</div>
    <div class="kpi-value">${formatHours(totalSeconds)}</div>
    <div class="kpi-sub">${formatHours(billableSeconds)} billable &nbsp;/&nbsp; ${formatHours(totalSeconds - billableSeconds)} non-billable</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Utilization</div>
    <div class="kpi-value ${utilPct >= 80 ? "green" : utilPct >= 50 ? "" : "red"}">${utilPct}%</div>
    <div class="kpi-sub">${avgHourlyRate > 0 ? `${settings.currency}${avgHourlyRate.toFixed(0)}/h avg rate` : "No billable rate set"}</div>
  </div>
</div>

${dailyHoursData.length > 0 ? `
<!-- ── Hours per Day ── -->
<div class="section-title">Hours per Day</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Date</th><th>Hours Logged</th><th class="r">Hours</th></tr></thead>
    <tbody>
      ${dailyHoursData.map((d) => `
      <tr>
        <td>${d.label}</td>
        <td class="bar-cell"><div class="bar-bg"><div class="bar-fill-blue" style="width:${Math.round((d.value / maxDailyHours) * 100)}%"></div></div></td>
        <td class="r">${d.value.toFixed(1)}h</td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9">
        <td style="font-weight:700;color:#0f172a">Total</td>
        <td></td>
        <td class="r" style="color:#3b82f6">${formatHours(totalSeconds)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

${dailyRevenueData.length > 0 ? `
<!-- ── Revenue per Day ── -->
<div class="section-title">Revenue per Day</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Date</th><th>Revenue</th><th class="r">Amount</th></tr></thead>
    <tbody>
      ${dailyRevenueData.map((d) => `
      <tr>
        <td>${d.label}</td>
        <td class="bar-cell"><div class="bar-bg"><div class="bar-fill-green" style="width:${Math.round((d.value / maxDailyRev) * 100)}%"></div></div></td>
        <td class="r">${formatCurrency(d.value, settings.currency)}</td>
      </tr>`).join("")}
      <tr style="background:#f1f5f9">
        <td style="font-weight:700;color:#0f172a">Total</td>
        <td></td>
        <td class="r" style="color:#059669">${formatCurrency(totalRevenue, settings.currency)}</td>
      </tr>
    </tbody>
  </table>
</div>` : ""}

${clientBreakdown.length > 0 ? `
<!-- ── Hours by Client ── -->
<div class="section-title">Hours by Client</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Client</th><th>Share</th><th class="r">Hours</th><th class="r">Earned</th></tr></thead>
    <tbody>
      ${clientBreakdown.map((item) => {
        const pct = Math.round((item.seconds / totalClientSec) * 100);
        return `<tr>
          <td>${item.client?.name || "Unknown"}</td>
          <td class="bar-cell"><div class="bar-bg"><div class="bar-fill-blue" style="width:${Math.round((item.seconds / maxClientSec) * 100)}%"></div></div></td>
          <td class="r">${formatHours(item.seconds)} <span style="color:#94a3b8;font-size:10px">(${pct}%)</span></td>
          <td class="r">${formatCurrency(item.earned, settings.currency)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</div>` : ""}

${taskBreakdown.length > 0 ? `
<!-- ── Hours by Task ── -->
<div class="section-title">Hours by Task</div>
<div class="table-wrap">
  <table>
    <thead><tr><th>Task</th><th class="r">Hours</th><th class="r">Earned</th></tr></thead>
    <tbody>
      ${taskBreakdown.map((item) => `<tr>
        <td>${item.taskTitle}</td>
        <td class="r">${formatHours(item.seconds)}</td>
        <td class="r">${formatCurrency(item.earned, settings.currency)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}

${invoiceStatus.total > 0 ? `
<!-- ── Invoice Status ── -->
<div class="section-title">Invoice Status</div>
<div class="inv-grid">
  <div class="inv-card paid">
    <div class="inv-status">Paid</div>
    <div class="inv-count">${invoiceStatus.paid}</div>
    <div class="inv-label">${invoiceStatus.paid === 1 ? "invoice" : "invoices"}</div>
  </div>
  <div class="inv-card sent">
    <div class="inv-status">Sent / Awaiting</div>
    <div class="inv-count">${invoiceStatus.sent}</div>
    <div class="inv-label">${invoiceStatus.sent === 1 ? "invoice" : "invoices"}</div>
  </div>
  <div class="inv-card overdue">
    <div class="inv-status">Overdue</div>
    <div class="inv-count">${invoiceStatus.overdue}</div>
    <div class="inv-label">${invoiceStatus.overdue === 1 ? "invoice" : "invoices"}</div>
  </div>
  <div class="inv-card draft">
    <div class="inv-status">Draft</div>
    <div class="inv-count">${invoiceStatus.draft}</div>
    <div class="inv-label">${invoiceStatus.draft === 1 ? "invoice" : "invoices"}</div>
  </div>
</div>` : ""}

${insights.length > 0 ? `
<!-- ── Insights ── -->
<div class="section-title">Insights</div>
<div class="insights-grid">
  ${insights.map((ins) => `<div class="insight"><span class="ins-icon">${ins.icon}</span><span class="ins-text">${ins.text}</span></div>`).join("")}
</div>` : ""}

<!-- ── Footer ── -->
<div class="footer">
  <span><strong>${companyName}</strong></span>
  <span>${bounds.label} Report &nbsp;·&nbsp; <strong>HourLink</strong></span>
</div>

</body>
</html>`;
      if (Platform.OS === "web") {
        const filename = `${companyName.replace(/[^a-z0-9]/gi, "_")}_${bounds.label.replace(/[^a-z0-9]/gi, "_")}_Report`;
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;border:0;opacity:0;";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || (iframe.contentWindow as any)?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          if (iframe.contentWindow) {
            iframe.contentWindow.document.title = filename;
            iframe.contentWindow.onafterprint = () => {
              document.body.removeChild(iframe);
              setExporting(false);
            };
            setTimeout(() => {
              iframe.contentWindow!.focus();
              iframe.contentWindow!.print();
            }, 400);
          }
        }
        return;
      } else {
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${bounds.label} Report`, UTI: "com.adobe.pdf" });
      }
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
          {exporting ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name="document-outline" size={16} color="#fff" />}
          <Text style={styles.exportBtnText}>{exporting ? "Generating…" : "Export PDF"}</Text>
        </TouchableOpacity>
      </View>

      {/* Period tabs */}
      <View style={[styles.periodRow, { backgroundColor: colors.muted }]}>
        {(["week", "month", "quarter", "year"] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && { backgroundColor: colors.primary }]}
            onPress={() => handlePeriodChange(p)}
          >
            <Text style={[styles.periodLabel, { color: period === p ? "#fff" : colors.mutedForeground }]}>
              {p === "quarter" ? "Qtr" : p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period navigator */}
      <View style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.navArrow, { backgroundColor: colors.muted }]} onPress={() => setOffset(o => o - 1)}>
          <AppIcon name="chevron-back" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={[styles.navLabel, { color: colors.foreground }]}>{bounds.label}</Text>
          <Text style={[styles.navSub, { color: colors.mutedForeground }]}>{bounds.sublabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.navArrow, { backgroundColor: offset >= 0 ? colors.muted + "60" : colors.muted }]}
          onPress={() => setOffset(o => Math.min(0, o + 1))}
          disabled={offset >= 0}
        >
          <AppIcon name="chevron-forward" size={16} color={offset >= 0 ? colors.mutedForeground : colors.foreground} />
        </TouchableOpacity>
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
              {changePrefix(revenueChange)}{revenueChange.toFixed(0)}% vs prev
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

      {/* Daily Hours Chart */}
      {dailyHoursData.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours per Day</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart data={dailyHoursData} color={colors.primary} formatValue={(v) => `${v.toFixed(1)}h`} />
          </View>
        </>
      )}

      {/* Daily Revenue Chart */}
      {dailyRevenueData.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue per Day</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart data={dailyRevenueData} color="#10b981" formatValue={(v) => `${settings.currency}${v}`} />
          </View>
        </>
      )}

      {/* Client Breakdown */}
      {clientBreakdown.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hours by Client</Text>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <VerticalBarChart
              data={clientBreakdown.map((item) => ({ label: item.client?.name?.split(" ")[0] || "?", value: parseFloat((item.seconds / 3600).toFixed(2)) }))}
              color="#f59e0b" formatValue={(v) => `${v.toFixed(1)}h`}
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

      {/* Task Breakdown */}
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
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <AppIcon name="bar-chart-outline" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No data for {bounds.sublabel.toLowerCase()}</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            {offset === 0
              ? "Start tracking time and sending invoices to see your reports."
              : `No time entries or paid invoices found for ${bounds.label}.`}
          </Text>
          {offset < 0 && (
            <TouchableOpacity style={[styles.todayBtn, { backgroundColor: colors.primary }]} onPress={() => setOffset(0)}>
              <Text style={styles.todayBtnText}>Back to current {period}</Text>
            </TouchableOpacity>
          )}
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
  periodRow: { flexDirection: "row", borderRadius: 12, padding: 4, marginBottom: 12 },
  periodBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  periodLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  navRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8, gap: 10 },
  navArrow: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  navCenter: { flex: 1, alignItems: "center", gap: 2 },
  navLabel: { fontSize: 15, fontFamily: "Inter_700Bold" },
  navSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
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
  clientName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
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
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  todayBtn: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  todayBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
