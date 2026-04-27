import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getUncachableResendClient } from "../lib/resend";
import { checkEntitlement } from "../lib/revenuecat";
import { logger } from "../lib/logger";
import { buildReceiptHtml } from "../lib/receiptEmail";
import { PLAN_BY_LABEL } from "../lib/planCatalog";

const router = Router();

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

    const plan = planName ? PLAN_BY_LABEL[planName] : undefined;
    if (!plan) {
      const validPlans = Object.keys(PLAN_BY_LABEL).join("' or '");
      logger.warn({ ip, planName }, "[receipt] rejected unknown plan");
      res.status(400).json({ error: `planName must be '${validPlans}'` });
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

    const html = buildReceiptHtml({
      planLabel: plan.label,
      planPrice: plan.price,
      purchaseDateStr,
      billingDateStr,
    });

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
