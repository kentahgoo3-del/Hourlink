import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;

router.post("/webhooks/revenuecat", (req: Request, res: Response) => {
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

  const event = req.body as {
    event?: {
      type?: string;
      app_user_id?: string;
      product_id?: string;
      period_type?: string;
      purchased_at_ms?: number;
      expiration_at_ms?: number;
      environment?: string;
    };
  };

  const type = event?.event?.type ?? "UNKNOWN";
  const userId = event?.event?.app_user_id ?? "unknown";
  const productId = event?.event?.product_id ?? "unknown";
  const environment = event?.event?.environment ?? "unknown";

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
