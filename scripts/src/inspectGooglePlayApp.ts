import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listApps,
  listAppPublicApiKeys,
  listProducts,
  listEntitlements,
  listOfferings,
} from "@replit/revenuecat-sdk";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const GOOGLE_PLAY_APP_ID = process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID!;

async function main() {
  const client = await getUncachableRevenueCatClient();

  console.log("=== All Apps ===");
  const { data: apps, error: appsError } = await listApps({
    client,
    path: { project_id: PROJECT_ID },
  });
  if (appsError) {
    console.error("Failed to list apps:", appsError);
    return;
  }
  for (const app of apps.items) {
    console.log(`  - ${app.name} (${app.id}) type=${app.type}`);
  }

  console.log("\n=== Google Play App API Keys ===");
  console.log(`Looking up app: ${GOOGLE_PLAY_APP_ID}`);
  const { data: keys, error: keysError } = await listAppPublicApiKeys({
    client,
    path: { project_id: PROJECT_ID, app_id: GOOGLE_PLAY_APP_ID },
  });
  if (keysError) {
    console.error("Failed to list API keys:", keysError);
  } else {
    console.log(JSON.stringify(keys, null, 2));
  }

  console.log("\n=== Entitlements ===");
  const { data: entitlements, error: entError } = await listEntitlements({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 20 },
  });
  if (entError) {
    console.error("Failed to list entitlements:", entError);
  } else {
    for (const ent of entitlements.items) {
      console.log(`  - ${ent.lookup_key} (${ent.id})`);
    }
  }

  console.log("\n=== Products ===");
  const { data: products, error: prodError } = await listProducts({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 50 },
  });
  if (prodError) {
    console.error("Failed to list products:", prodError);
  } else {
    for (const prod of products.items) {
      console.log(`  - ${prod.store_identifier} (${prod.id}) app_id=${prod.app_id}`);
    }
  }

  console.log("\n=== Offerings ===");
  const { data: offerings, error: offError } = await listOfferings({
    client,
    path: { project_id: PROJECT_ID },
    query: { limit: 20 },
  });
  if (offError) {
    console.error("Failed to list offerings:", offError);
  } else {
    for (const off of offerings.items) {
      console.log(`  - ${off.display_name ?? off.lookup_key} (${off.id}) current=${off.is_current}`);
    }
  }
}

main().catch(console.error);
