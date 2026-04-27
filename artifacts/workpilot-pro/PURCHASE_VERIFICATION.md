# Android Production Purchase Verification

## Static Code Audit — Completed

All code paths exercised by a real Android purchase were reviewed against the
production RevenueCat project (`proj0fd45034`, app `app63ce0d4074`).

### 1. SDK initialisation

**File:** `app/_layout.tsx` line 25  
`initializeRevenueCat()` is called at module load — before any React component
renders — so the SDK is ready before the first subscription fetch.

**File:** `lib/revenuecat.tsx` lines 104–115  
On Android the key is sourced from `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
The shared environment variable is set to the production key
`goog_TpWRaazBMjbhmtSpXJuRJaRKpbX`. ✓

### 2. Offering / paywall load

`fetchSubState()` calls `RNPurchases.getOfferings()` on the native path.
The result is normalised through `normalizeOffering()` which maps each
`RCPackage` to an `OfferingPackage` with the correct identifier, price string,
and trial eligibility. ✓

### 3. Purchase flow (`pro_monthly:monthly`)

`purchasePackage()` → `confirmPurchase()`:
1. Fetches current offerings to resolve the native `RCPackage` object.
2. Calls `RNPurchases.purchasePackage(nativePkg)` — the real Google Play sheet.
3. On success, calls `refreshSubscription()` which invalidates the React Query
   cache and triggers a fresh `getCustomerInfo()` call.

Entitlement mapping in `fetchSubState()`:
```ts
const isPro = !!active["pro"] || !!active["business"];
```
Active entitlement key `"pro"` → `isPro = true`. ✓

### 4. Restore flow

`restorePurchases()` calls `RNPurchases.restorePurchases()` then
`refreshSubscription()`. On a fresh install with the same Google account the
entitlements are re-fetched and `isPro` updates immediately. ✓

### 5. EAS build configuration

`eas.json` production profile:
```json
"production": { "autoIncrement": true }
```
Package name in `app.json`: `com.kentahgoo.workpilotpro` ✓

---

## Manual Verification Checklist

The following steps require a physical Android device and EAS CLI access and
**must be completed by the developer** to fully satisfy this task.

### Pre-build
- [ ] Add `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` as an EAS environment variable
  via the Expo dashboard or:
  ```
  eas secret:create --name EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY \
    --value goog_TpWRaazBMjbhmtSpXJuRJaRKpbX --scope project
  ```

### Build & install
- [ ] Submit production build:
  ```
  eas build --profile production --platform android
  ```
- [ ] Record the EAS build URL and version code here: `_____________`
- [ ] Install the resulting APK/AAB on a physical Android device via
  `eas build:run` or internal testing track.

### Purchase test (`pro_monthly:monthly`)
- [ ] Open the app — confirm no `[RevenueCat] No API key found` warning in logs.
- [ ] Navigate to the paywall — confirm offerings load (price and trial text visible).
- [ ] Tap the Pro Monthly package — confirm the Google Play purchase sheet appears.
- [ ] Complete the purchase (use a test account or sandbox purchase).
- [ ] Confirm app shows `isPro = true` state (paywall dismissed, Pro features unlocked).

### Restore test (fresh install)
- [ ] Uninstall and reinstall the app on the same Google account.
- [ ] Tap "Restore Purchases" from the paywall or settings.
- [ ] Confirm `isPro = true` is reflected without a new purchase.

---

## Known prerequisite before build submission

EAS cloud builds do not inherit Replit secrets. The
`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` **must** be registered as an EAS
project secret before building or the SDK will silently skip initialisation.
See follow-up task #33.
