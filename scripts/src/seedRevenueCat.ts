import { getUncachableRevenueCatClient, type RCClient } from './revenueCatClient';
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'HourLink';

const APP_STORE_APP_NAME = 'HourLink iOS';
const APP_STORE_BUNDLE_ID = 'com.kentahgoo.workpilotpro';
const PLAY_STORE_APP_NAME = 'HourLink Android';
const PLAY_STORE_PACKAGE_NAME = 'com.kentahgoo.workpilotpro';

const OFFERING_IDENTIFIER = 'default';
const OFFERING_DISPLAY_NAME = 'Default Offering';

function rcErrorHasType(e: unknown): e is { type: string; message?: string } {
  return (
    typeof e === 'object' &&
    e !== null &&
    'type' in e &&
    typeof (e as Record<string, unknown>)['type'] === 'string'
  );
}

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

type ProductConfig = {
  id: string;
  playStoreId: string;
  displayName: string;
  title: string;
  duration: string;
  prices: { amount_micros: number; currency: string }[];
  entitlementId: string;
  entitlementDisplayName: string;
  packageId: string;
  packageDisplayName: string;
};

const PRODUCTS: ProductConfig[] = [
  {
    id: 'free_access',
    playStoreId: 'free_access',
    displayName: 'Free',
    title: 'HourLink Free',
    duration: 'P0D',
    prices: [{ amount_micros: 0, currency: 'USD' }],
    entitlementId: 'free',
    entitlementDisplayName: 'Free Access',
    packageId: '$rc_lifetime',
    packageDisplayName: 'Free',
  },
  {
    id: 'pro_monthly',
    playStoreId: 'pro_monthly:monthly',
    displayName: 'Pro Monthly',
    title: 'HourLink Pro',
    duration: 'P1M',
    prices: [{ amount_micros: 9990000, currency: 'USD' }],
    entitlementId: 'pro',
    entitlementDisplayName: 'Pro Access',
    packageId: '$rc_monthly',
    packageDisplayName: 'Pro Monthly',
  },
  {
    id: 'business_monthly',
    playStoreId: 'business_monthly:monthly',
    displayName: 'Business Monthly',
    title: 'HourLink Business',
    duration: 'P1M',
    prices: [{ amount_micros: 19990000, currency: 'USD' }],
    entitlementId: 'business',
    entitlementDisplayName: 'Business Access',
    packageId: 'business_monthly',
    packageDisplayName: 'Business Monthly',
  },
];

async function ensureProductForApp(
  client: RCClient,
  project: Project,
  targetApp: App,
  label: string,
  productIdentifier: string,
  config: ProductConfig,
  existingProducts: { items?: Product[] },
  isTestStore: boolean
): Promise<Product> {
  const existingProduct = existingProducts.items?.find(
    (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id
  );

  if (existingProduct) {
    console.log(`${label} product already exists: ${existingProduct.id}`);
    return existingProduct;
  }

  const body: CreateProductData['body'] = {
    store_identifier: productIdentifier,
    app_id: targetApp.id,
    type: 'subscription',
    display_name: config.displayName,
  };

  if (isTestStore) {
    body.subscription = { duration: config.duration };
    body.title = config.title;
  }

  const { data: createdProduct, error } = await createProduct({
    client,
    path: { project_id: project.id },
    body,
  });

  if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
  console.log(`Created ${label} product: ${createdProduct.id}`);
  return createdProduct;
}

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });

  if (listProjectsError) throw new Error('Failed to list projects');

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);

  if (existingProject) {
    console.log('Project already exists:', existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error: createProjectError } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (createProjectError) throw new Error('Failed to create project');
    console.log('Created project:', newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error('No apps found');
  }

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === 'test_store');
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === 'app_store');
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === 'play_store');

  if (!testStoreApp) {
    throw new Error('No test store app found');
  } else {
    console.log('Test Store app found:', testStoreApp.id);
  }

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: 'app_store',
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error('Failed to create App Store app');
    appStoreApp = newApp;
    console.log('Created App Store app:', appStoreApp.id);
  } else {
    console.log('App Store app found:', appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: 'play_store',
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error('Failed to create Play Store app');
    playStoreApp = newApp;
    console.log('Created Play Store app:', playStoreApp.id);
  } else {
    console.log('Play Store app found:', playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });

  if (listProductsError) throw new Error('Failed to list products');

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listOfferingsError) throw new Error('Failed to list offerings');

  const existingOffering = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER
  );

  if (existingOffering) {
    console.log('Offering already exists:', existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: OFFERING_IDENTIFIER,
        display_name: OFFERING_DISPLAY_NAME,
      },
    });
    if (error) throw new Error('Failed to create offering');
    console.log('Created offering:', newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error('Failed to set offering as current');
    console.log('Set offering as current');
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });

  if (listPackagesError) throw new Error('Failed to list packages');

  for (const config of PRODUCTS) {
    console.log(`\n--- Setting up ${config.displayName} ---`);

    const testStoreProduct = await ensureProductForApp(
      client, project, testStoreApp, 'Test Store ' + config.displayName,
      config.id, config, existingProducts, true
    );
    const appStoreProduct = await ensureProductForApp(
      client, project, appStoreApp, 'App Store ' + config.displayName,
      config.id, config, existingProducts, false
    );
    const playStoreProduct = await ensureProductForApp(
      client, project, playStoreApp, 'Play Store ' + config.displayName,
      config.playStoreId, config, existingProducts, false
    );

    console.log(`Adding test store prices for ${config.displayName}...`);
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: '/projects/{project_id}/products/{product_id}/test_store_prices',
      path: { project_id: project.id, product_id: testStoreProduct.id },
      body: { prices: config.prices },
    });

    if (priceError) {
      if (rcErrorHasType(priceError) && priceError.type === 'resource_already_exists') {
        console.log('Test store prices already exist for this product');
      } else {
        console.warn('Warning adding test store prices:', JSON.stringify(priceError));
      }
    } else {
      console.log('Added test store prices');
    }

    const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });
    if (listEntitlementsError) throw new Error('Failed to list entitlements');

    let entitlement: Entitlement | undefined;
    const existingEntitlement = existingEntitlements.items?.find(
      (e) => e.lookup_key === config.entitlementId
    );

    if (existingEntitlement) {
      console.log(`Entitlement "${config.entitlementId}" already exists:`, existingEntitlement.id);
      entitlement = existingEntitlement;
    } else {
      const { data: newEntitlement, error } = await createEntitlement({
        client,
        path: { project_id: project.id },
        body: {
          lookup_key: config.entitlementId,
          display_name: config.entitlementDisplayName,
        },
      });
      if (error) throw new Error(`Failed to create entitlement: ${JSON.stringify(error)}`);
      console.log(`Created entitlement "${config.entitlementId}":`, newEntitlement.id);
      entitlement = newEntitlement;
    }

    const { error: attachEntitlementError } = await attachProductsToEntitlement({
      client,
      path: { project_id: project.id, entitlement_id: entitlement.id },
      body: {
        product_ids: [testStoreProduct.id, appStoreProduct.id, playStoreProduct.id],
      },
    });

    if (attachEntitlementError) {
      if (rcErrorHasType(attachEntitlementError) && attachEntitlementError.type === 'unprocessable_entity_error') {
        console.log('Products already attached to entitlement');
      } else {
        throw new Error(`Failed to attach products to entitlement: ${JSON.stringify(attachEntitlementError)}`);
      }
    } else {
      console.log('Attached products to entitlement');
    }

    let pkg: Package | undefined;
    const existingPackage = existingPackages.items?.find(
      (p) => p.lookup_key === config.packageId
    );

    if (existingPackage) {
      console.log(`Package "${config.packageId}" already exists:`, existingPackage.id);
      pkg = existingPackage;
    } else {
      const { data: newPackage, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: {
          lookup_key: config.packageId,
          display_name: config.packageDisplayName,
        },
      });
      if (error) throw new Error(`Failed to create package: ${JSON.stringify(error)}`);
      console.log(`Created package "${config.packageId}":`, newPackage.id);
      pkg = newPackage;
    }

    const { error: attachPackageError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testStoreProduct.id, eligibility_criteria: 'all' },
          { product_id: appStoreProduct.id, eligibility_criteria: 'all' },
          { product_id: playStoreProduct.id, eligibility_criteria: 'all' },
        ],
      },
    });

    if (attachPackageError) {
      if (
        rcErrorHasType(attachPackageError) &&
        attachPackageError.type === 'unprocessable_entity_error' &&
        attachPackageError.message?.includes('Cannot attach product')
      ) {
        console.log('Package already has attached products');
      } else {
        throw new Error(`Failed to attach products to package: ${JSON.stringify(attachPackageError)}`);
      }
    } else {
      console.log('Attached products to package');
    }
  }

  const { data: testStoreApiKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: testStoreApp.id },
  });
  const { data: appStoreApiKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  const { data: playStoreApiKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: playStoreApp.id },
  });

  console.log('\n====================');
  console.log('RevenueCat setup complete!');
  console.log('Project ID:', project.id);
  console.log('Test Store App ID:', testStoreApp.id);
  console.log('App Store App ID:', appStoreApp.id);
  console.log('Play Store App ID:', playStoreApp.id);
  console.log('Public API Key (Test Store):', testStoreApiKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('Public API Key (App Store):', appStoreApiKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('Public API Key (Play Store):', playStoreApiKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('====================\n');
  console.log('Environment variables to set:');
  console.log(`REVENUECAT_PROJECT_ID=${project.id}`);
  console.log(`REVENUECAT_TEST_STORE_APP_ID=${testStoreApp.id}`);
  console.log(`REVENUECAT_APPLE_APP_STORE_APP_ID=${appStoreApp.id}`);
  console.log(`REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=${playStoreApp.id}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=${testStoreApiKeys?.items[0]?.key ?? ''}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=${appStoreApiKeys?.items[0]?.key ?? ''}`);
  console.log(`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=${playStoreApiKeys?.items[0]?.key ?? ''}`);
}

seedRevenueCat().catch(console.error);
