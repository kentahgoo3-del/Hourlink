import { Platform } from "react-native";
import type { BillingTransaction } from "@/lib/revenuecat";

const IS_WEB = Platform.OS === "web";

function planNameFromAmount(amount: string): string {
  if (amount.startsWith("$19")) return "Business Monthly";
  if (amount.startsWith("$9")) return "Pro Monthly";
  return "Subscription";
}

function formatDateLong(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

function receiptNumber(isoString: string, amount: string): string {
  const ts = new Date(isoString).getTime();
  const seed = Math.abs(ts ^ amount.length * 999_999);
  return "WP-" + String(seed).slice(0, 8).padStart(8, "0");
}

export function buildReceiptHtml(tx: BillingTransaction): string {
  const plan = planNameFromAmount(tx.amount);
  const dateLabel = formatDateLong(tx.date);
  const receipt = receiptNumber(tx.date, tx.amount);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Receipt — ${dateLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #f8fafc;
    color: #0f172a;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    min-height: 100vh;
    padding: 40px 16px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 40px;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 4px 32px rgba(0,0,0,0.08);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 32px;
  }
  .logo-circle {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .logo-circle span {
    font-size: 22px;
    color: #fff;
  }
  .app-name {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }
  .app-sub {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
  }
  .divider {
    height: 1px;
    background: #e2e8f0;
    margin: 20px 0;
  }
  .receipt-title {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .amount-block {
    text-align: center;
    margin-bottom: 28px;
  }
  .amount {
    font-size: 52px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -1px;
    line-height: 1;
  }
  .amount-label {
    font-size: 14px;
    color: #64748b;
    margin-top: 6px;
  }
  .status-badge {
    display: inline-block;
    background: #dcfce7;
    color: #16a34a;
    font-size: 12px;
    font-weight: 600;
    border-radius: 100px;
    padding: 4px 14px;
    margin-top: 10px;
  }
  .details-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  .details-table tr td {
    padding: 11px 0;
    font-size: 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .details-table tr:last-child td {
    border-bottom: none;
  }
  .details-table .label {
    color: #64748b;
    font-weight: 500;
  }
  .details-table .value {
    text-align: right;
    color: #0f172a;
    font-weight: 600;
  }
  .footer {
    margin-top: 28px;
    text-align: center;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.6;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .card { box-shadow: none; border-radius: 0; max-width: 100%; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo-circle"><span>⚡</span></div>
    <div>
      <div class="app-name">WorkPilot Pro</div>
      <div class="app-sub">Billing Receipt</div>
    </div>
  </div>

  <div class="receipt-title">Receipt</div>

  <div class="amount-block">
    <div class="amount">${tx.amount}</div>
    <div class="amount-label">${plan}</div>
    <div><span class="status-badge">${tx.status}</span></div>
  </div>

  <div class="divider"></div>

  <table class="details-table">
    <tr>
      <td class="label">Date</td>
      <td class="value">${dateLabel}</td>
    </tr>
    <tr>
      <td class="label">Plan</td>
      <td class="value">${plan}</td>
    </tr>
    <tr>
      <td class="label">Amount</td>
      <td class="value">${tx.amount}</td>
    </tr>
    <tr>
      <td class="label">Status</td>
      <td class="value">${tx.status}</td>
    </tr>
    <tr>
      <td class="label">Receipt #</td>
      <td class="value">${receipt}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="footer">
    Thank you for your subscription to WorkPilot Pro.<br/>
    This is your official billing receipt. Keep it for your records.
  </div>
</div>
</body>
</html>`;
}

export async function downloadOrShareReceipt(tx: BillingTransaction): Promise<void> {
  const html = buildReceiptHtml(tx);
  if (IS_WEB) {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
        }
      }, 400);
    }
    return;
  }

  const Print = await import("expo-print");
  const Sharing = await import("expo-sharing");

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Save or share receipt",
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ uri });
  }
}
