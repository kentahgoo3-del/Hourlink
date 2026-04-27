let connectionSettings:
  | {
      settings: {
        access_token?: string;
        expires_at?: string;
        oauth?: { credentials?: { access_token?: string } };
      };
    }
  | undefined;

async function getApiKey(): Promise<string> {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    const token =
      connectionSettings.settings.access_token ??
      connectionSettings.settings.oauth?.credentials?.access_token;
    if (token) return token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=revenuecat",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data: { items?: typeof connectionSettings[] }) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ??
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("RevenueCat not connected");
  }
  return accessToken;
}

let cachedProjectId: string | null = null;

async function getProjectId(token: string): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const res = await fetch("https://api.revenuecat.com/v2/projects", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`RevenueCat projects API error ${res.status}`);
  }
  const data = (await res.json()) as { items?: Array<{ id: string }> };
  const projectId = data.items?.[0]?.id;
  if (!projectId) {
    throw new Error("No RevenueCat project found");
  }
  cachedProjectId = projectId;
  return projectId;
}

export type RCCustomerEntitlement = {
  expires_at?: string | null;
  product_identifier?: string;
};

export type RCCustomer = {
  id?: string;
  entitlements?: {
    items?: Array<{
      id?: string;
      expires_at?: string | null;
      product?: { product_identifier?: string };
    }>;
  };
  subscriptions?: {
    items?: Array<{
      status?: string;
      current_period_ends_at?: string | null;
      product?: { id?: string };
    }>;
  };
};

export type EntitlementResult = {
  verified: false;
} | {
  verified: true;
  nextBillingAt: Date | null;
};

export async function checkEntitlement(
  appUserId: string,
  allowedEntitlements: string[]
): Promise<EntitlementResult> {
  const token = await getApiKey();
  const projectId = await getProjectId(token);

  const res = await fetch(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(appUserId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.status === 404) {
    return { verified: false };
  }
  if (!res.ok) {
    throw new Error(`RevenueCat customer API error ${res.status}`);
  }

  const data = (await res.json()) as RCCustomer;

  const activeSubscriptions = (data.subscriptions?.items ?? []).filter(
    (sub) => sub.status === "active" || sub.status === "in_trial"
  );

  if (activeSubscriptions.length === 0) {
    return { verified: false };
  }

  const entitlementItems = data.entitlements?.items ?? [];
  const hasMatch = entitlementItems.some((ent) =>
    allowedEntitlements.some(
      (allowed) =>
        ent.id === allowed ||
        ent.product?.product_identifier?.includes(allowed)
    )
  );

  if (!hasMatch) {
    return { verified: false };
  }

  const expiryStr = activeSubscriptions[0]?.current_period_ends_at;
  const nextBillingAt = expiryStr ? new Date(expiryStr) : null;

  return { verified: true, nextBillingAt };
}
