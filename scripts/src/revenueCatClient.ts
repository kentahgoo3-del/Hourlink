import { createClient } from '@replit/revenuecat-sdk/client';

interface ConnectionSettings {
  settings: {
    expires_at?: string;
    access_token?: string;
    oauth?: {
      credentials?: {
        access_token?: string;
      };
    };
  };
}

export type RCClient = ReturnType<typeof createClient>;

let connectionSettings: ConnectionSettings | null = null;

async function getApiKey() {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=revenuecat',
    {
      headers: {
        Accept: 'application/json',
        'X-Replit-Token': xReplitToken,
      },
    }
  );
  const data = await response.json() as { items?: ConnectionSettings[] };
  connectionSettings = data.items?.[0] ?? null;

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('RevenueCat not connected');
  }
  return accessToken;
}

export async function getUncachableRevenueCatClient(): Promise<RCClient> {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: 'https://api.revenuecat.com/v2',
    headers: { Authorization: 'Bearer ' + apiKey },
  });
}
