import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getUncachableResendClient } from "../lib/resend";
import { checkEntitlement } from "../lib/revenuecat";
import { logger } from "../lib/logger";

const router = Router();

const ALLOWED_PLANS: Record<string, { label: string; price: string; entitlements: string[] }> = {
  "Pro Monthly": { label: "Pro Monthly", price: "$9.99", entitlements: ["pro", "business"] },
  "Business Monthly": { label: "Business Monthly", price: "$19.99", entitlements: ["business"] },
};

const receiptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many receipt requests from this IP. Try again later." },
  keyGenerator: (req: Request) =>
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
    req.socket.remoteAddress ??
    "unknown",
});

const IS_DEV = process.env.NODE_ENV !== "production";

router.post(
  "/subscription/receipt",
  receiptLimiter,
  async (req: Request, res: Response) => {
    const { email, planName, appUserId, webMock } = req.body as {
      email?: string;
      planName?: string;
      appUserId?: string;
      webMock?: boolean;
    };

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";

    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const plan = planName ? ALLOWED_PLANS[planName] : undefined;
    if (!plan) {
      logger.warn({ ip, planName }, "[receipt] rejected unknown plan");
      res.status(400).json({ error: "planName must be 'Pro Monthly' or 'Business Monthly'" });
      return;
    }

    const isWebMock = IS_DEV && webMock === true;
    let rcNextBillingAt: Date | null = null;

    if (isWebMock) {
      logger.info({ ip, plan: plan.label }, "[receipt] dev/web-mock purchase — skipping RevenueCat verification");
    } else {
      if (!appUserId || typeof appUserId !== "string" || !appUserId.trim()) {
        res.status(401).json({ error: "appUserId is required for purchase verification" });
        return;
      }

      try {
        const result = await checkEntitlement(appUserId.trim(), plan.entitlements);
        if (!result.verified) {
          logger.warn({ ip, appUserId, planName }, "[receipt] subscriber lacks entitlement");
          res.status(403).json({ error: "No active subscription found for this account" });
          return;
        }
        rcNextBillingAt = result.nextBillingAt;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ ip, appUserId, err: message }, "[receipt] RevenueCat verification failed");
        res.status(502).json({ error: "Unable to verify subscription. Try again later." });
        return;
      }
    }

    logger.info({ ip, plan: plan.label }, "[receipt] sending subscription receipt");

    const billingDateStr = (() => {
      const next = rcNextBillingAt ?? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      })();
      return next.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    })();

    const purchaseDateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WorkPilot Pro — Subscription Receipt</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 520px; margin: 40px auto; padding: 0 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 32px 32px 24px; }
    .header-logo { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .header-sub { font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 4px; }
    .body { padding: 32px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0 0 28px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-of-type { border-bottom: none; }
    .row-label { font-size: 13px; color: #64748b; }
    .row-value { font-size: 14px; font-weight: 600; color: #0f172a; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    .total-row { display: flex; justify-content: space-between; align-items: center; }
    .total-label { font-size: 15px; font-weight: 700; color: #0f172a; }
    .total-value { font-size: 20px; font-weight: 800; color: #3b82f6; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
    .footer-text { font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="header-logo">WorkPilot Pro</div>
        <div class="header-sub">Subscription Confirmation</div>
      </div>
      <div class="body">
        <p class="title">Your subscription is active!</p>
        <p class="subtitle">Thanks for subscribing. Here's your receipt for your records.</p>

        <div class="row">
          <span class="row-label">Plan</span>
          <span class="row-value">${plan.label}</span>
        </div>
        <div class="row">
          <span class="row-label">Purchase Date</span>
          <span class="row-value">${purchaseDateStr}</span>
        </div>
        <div class="row">
          <span class="row-label">Next Billing Date</span>
          <span class="row-value">${billingDateStr}</span>
        </div>

        <div class="divider"></div>

        <div class="total-row">
          <span class="total-label">Amount Charged</span>
          <span class="total-value">${plan.price}/mo</span>
        </div>
      </div>
      <div class="footer">
        <p class="footer-text">
          Subscription renews automatically each month. Cancel anytime in your app store account settings.<br/>
          Questions? Reply to this email or visit our support page.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    try {
      const { client, fromEmail } = await getUncachableResendClient();
      await client.emails.send({
        from: fromEmail,
        to: email,
        subject: `Your ${plan.label} subscription receipt`,
        html,
      });
      logger.info({ ip, plan: plan.label }, "[receipt] sent successfully");
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ ip, plan: plan.label, err: message }, "[receipt] email send failed");
      res.status(500).json({ error: "Failed to send receipt email" });
    }
  }
);

export default router;
