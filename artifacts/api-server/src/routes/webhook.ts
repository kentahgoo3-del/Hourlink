import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getUncachableResendClient } from "../lib/resend";
import { buildReceiptHtml } from "../lib/receiptEmail";
import { resolvePlanFromWebhook } from "../lib/planCatalog";

const router = Router();

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

type RCSubscriberAttribute = { value?: string; updated_at_ms?: number };

type RCWebhookEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  price?: number;
  currency?: string;
  environment?: string;
  entitlement_ids?: string[];
  subscriber_attributes?: Record<string, RCSubscriberAttribute>;
};

type RCWebhookBody = {
  event?: RCWebhookEvent;
  api_version?: string;
};

async function sendRenewalReceipt(event: RCWebhookEvent): Promise<void> {
  const email = event.subscriber_attributes?.["$email"]?.value;
  if (!email || !email.includes("@")) {
    logger.warn(
      { userId: event.app_user_id, productId: event.product_id },
      "[RC Webhook] RENEWAL — no subscriber email attribute, skipping receipt"
    );
    return;
  }

  const plan = resolvePlanFromWebhook({
    price: event.price,
    productId: event.product_id,
    entitlementIds: event.entitlement_ids,
  });
  if (!plan) {
    logger.warn(
      { userId: event.app_user_id, productId: event.product_id, price: event.price },
      "[RC Webhook] RENEWAL — could not resolve plan from event, skipping receipt"
    );
    return;
  }

  const purchaseDateStr = (() => {
    const d = event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date();
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  })();

  const billingDateStr = (() => {
    const d = event.expiration_at_ms ? new Date(event.expiration_at_ms) : (() => {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + 1);
      return fallback;
    })();
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  })();

  const html = buildReceiptHtml({
    planLabel: plan.label,
    planPrice: plan.price,
    purchaseDateStr,
    billingDateStr,
  });

  const { client, fromEmail } = await getUncachableResendClient();
  await client.emails.send({
    from: fromEmail,
    to: email,
    subject: `Your ${plan.label} subscription has renewed`,
    html,
  });

  logger.info(
    { userId: event.app_user_id, plan: plan.label, email },
    "[RC Webhook] RENEWAL — receipt sent"
  );
}

router.post("/webhooks/revenuecat", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"];

  if (!WEBHOOK_SECRET) {
    logger.error("[RC Webhook] REVENUECAT_WEBHOOK_SECRET is not set");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  if (authHeader !== WEBHOOK_SECRET) {
    logger.warn("[RC Webhook] Unauthorized request — invalid authorization header");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as RCWebhookBody;
  const event = body?.event ?? {};

  const type = event.type ?? "UNKNOWN";
  const userId = event.app_user_id ?? "unknown";
  const productId = event.product_id ?? "unknown";
  const environment = event.environment ?? "unknown";

  logger.info(
    { type, userId, productId, environment },
    "[RC Webhook] Event received"
  );

  switch (type) {
    case "INITIAL_PURCHASE":
      logger.info({ userId, productId }, "[RC Webhook] New subscription started");
      break;

    case "RENEWAL":
      logger.info({ userId, productId }, "[RC Webhook] Subscription renewed");
      try {
        await sendRenewalReceipt(event);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ userId, productId, err: message }, "[RC Webhook] RENEWAL — failed to send receipt");
      }
      break;

    case "CANCELLATION":
      logger.info({ userId, productId }, "[RC Webhook] Subscription cancelled");
      break;

    case "BILLING_ISSUE":
      logger.warn({ userId, productId }, "[RC Webhook] Billing issue detected");
      break;

    case "EXPIRATION":
      logger.info({ userId, productId }, "[RC Webhook] Subscription expired");
      break;

    case "PRODUCT_CHANGE":
      logger.info({ userId, productId }, "[RC Webhook] Plan changed");
      break;

    case "SUBSCRIBER_ALIAS":
      logger.info({ userId }, "[RC Webhook] Subscriber alias created");
      break;

    default:
      logger.info({ type, userId }, "[RC Webhook] Unhandled event type");
  }

  res.status(200).json({ received: true });
});

export default router;
