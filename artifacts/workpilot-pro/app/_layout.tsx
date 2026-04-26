import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Font from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { WelcomeProvider } from "@/context/WelcomeContext";
import { registerPushToken } from "@/services/pushNotifications";
import { SubscriptionProvider, initializeRevenueCat } from "@/lib/revenuecat";

initializeRevenueCat();

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="client/[id]" />
      <Stack.Screen name="invoice/[id]" />
      <Stack.Screen name="quote/[id]" />
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        });

        if (Platform.OS !== "web") {
          const code = await AsyncStorage.getItem("teamWorkspaceCode");
          const isOwner = await AsyncStorage.getItem("teamIsOwner");
          if (code && isOwner === "true") {
            registerPushToken(code).catch(() => {});
          }
        }
      } catch (e: any) {
        console.error('Font loading failed:', e?.message || e);
      } finally {
        setAppReady(true);
      }
    }
    prepare();

    if (Platform.OS !== "web") {
      notificationResponseListener.current =
        Notifications.addNotificationResponseReceivedListener(() => {
          router.push("/team" as any);
        });
    }

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) return null;

  return (
    <SafeAreaProvider style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <ThemeProvider>
            <ErrorBoundary>
              <AppProvider>
                <WelcomeProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <RootLayoutNav />
                  </GestureHandlerRootView>
                </WelcomeProvider>
              </AppProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </SubscriptionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
