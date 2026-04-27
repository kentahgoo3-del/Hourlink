import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listPackages,
  getProductsFromPackage,
  getProductsFromEntitlement,
} from "@replit/revenuecat-sdk";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID!;
const GOOGLE_PLAY_APP_ID = process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID!;
const OFFERING_ID = "ofrng38fe2d2bd6";
const ENT_PRO_ID = "entld391a91aa7";
const ENT_BUSINESS_ID = "entl2d023c3103";

async function main() {
  const client = await getUncachableRevenueCatClient();

  console.log("=== Offering Packages ===");
  const { data: packages, error: pkgError } = await listPackages({
    client,
    path: { project_id: PROJECT_ID, offering_id: OFFERING_ID },
    query: { limit: 20 },
  });
  if (pkgError) {
    console.error("Failed to list packages:", pkgError);
    return;
  }
  for (const pkg of packages.items) {
    console.log(`  Package: ${pkg.display_name ?? pkg.lookup_key} (${pkg.id})`);
    const { data: pkgProds, error: pkgProdError } = await getProductsFromPackage({
      client,
      path: { project_id: PROJECT_ID, offering_id: OFFERING_ID, package_id: pkg.id },
    });
    if (pkgProdError) {
      console.error("    Failed to get products:", pkgProdError);
    } else {
      for (const p of pkgProds.items) {
        const isGooglePlay = p.app_id === GOOGLE_PLAY_APP_ID;
        console.log(`    - ${p.store_identifier} (${p.id}) app_id=${p.app_id} ${isGooglePlay ? "✅ GOOGLE PLAY" : ""}`);
      }
    }
  }

  console.log("\n=== Products on 'pro' Entitlement ===");
  const { data: proEnts, error: proEntError } = await getProductsFromEntitlement({
    client,
    path: { project_id: PROJECT_ID, entitlement_id: ENT_PRO_ID },
    query: { limit: 20 },
  });
  if (proEntError) {
    console.error("Failed:", proEntError);
  } else {
    for (const p of proEnts.items) {
      const isGooglePlay = p.app_id === GOOGLE_PLAY_APP_ID;
      console.log(`  - ${p.store_identifier} (${p.id}) app_id=${p.app_id} ${isGooglePlay ? "✅ GOOGLE PLAY" : ""}`);
    }
  }

  console.log("\n=== Products on 'business' Entitlement ===");
  const { data: bizEnts, error: bizEntError } = await getProductsFromEntitlement({
    client,
    path: { project_id: PROJECT_ID, entitlement_id: ENT_BUSINESS_ID },
    query: { limit: 20 },
  });
  if (bizEntError) {
    console.error("Failed:", bizEntError);
  } else {
    for (const p of bizEnts.items) {
      const isGooglePlay = p.app_id === GOOGLE_PLAY_APP_ID;
      console.log(`  - ${p.store_identifier} (${p.id}) app_id=${p.app_id} ${isGooglePlay ? "✅ GOOGLE PLAY" : ""}`);
    }
  }
}

main().catch(console.error);
