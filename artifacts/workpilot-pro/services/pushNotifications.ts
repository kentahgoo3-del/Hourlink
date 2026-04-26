import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "https://hourlink-api.onrender.com/api";
const STORED_TOKEN_KEY = "push_token_registered";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(workspaceCode: string): Promise<void> {
  try {
    if (Platform.OS === "web") return;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ experienceId: undefined, projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;

    const prevEntry = await AsyncStorage.getItem(STORED_TOKEN_KEY);
    const prev = prevEntry ? JSON.parse(prevEntry) : null;

    if (prev?.token === token && prev?.code === workspaceCode) return;

    await fetch(`${API_BASE}/workspaces/${workspaceCode}/push-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    await AsyncStorage.setItem(
      STORED_TOKEN_KEY,
      JSON.stringify({ token, code: workspaceCode }),
    );
  } catch (err) {
    console.warn("Push token registration failed:", err);
  }
}

export async function unregisterPushToken(workspaceCode: string): Promise<void> {
  try {
    const entry = await AsyncStorage.getItem(STORED_TOKEN_KEY);
    if (!entry) return;
    const { token } = JSON.parse(entry);
    if (!token) return;
    await fetch(
      `${API_BASE}/workspaces/${workspaceCode}/push-tokens/${encodeURIComponent(token)}`,
      { method: "DELETE" },
    );
    await AsyncStorage.removeItem(STORED_TOKEN_KEY);
  } catch (err) {
    console.warn("Push token unregistration failed:", err);
  }
}
