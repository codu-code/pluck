import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Settings, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient, syncPending } from "@/lib/data";
import { kv } from "@/lib/kv";
import { defaultServer, getSession, isSignedIn, onSession, signInWithKey } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const persister = createAsyncStoragePersister({ storage: kv.storage, key: "queryCache" });

export default function Root() {
  const t = useTheme();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // Screenshot and demo builds only (EXPO_PUBLIC_DEMO_KEY is never set for the store): sign in with a key.
      const demoKey = process.env.EXPO_PUBLIC_DEMO_KEY;
      if (demoKey && !(await getSession())?.apiKey) await signInWithKey(defaultServer, demoKey);
      setSignedIn(await isSignedIn());
      // Demo builds take a screen to open as a launch argument (simctl launch … -demoRoute /lists/…), for screenshots.
      const route = demoKey ? (Settings.get("demoRoute") as string | undefined) : undefined;
      if (route) setTimeout(() => router.push(route as never), 300);
    })();
    const off = onSession((s) => {
      setSignedIn(Boolean(s?.access || s?.apiKey));
      if (!s) queryClient.clear();
    });
    // Coming back to the app is when queued plucks (from the app or the share sheet) go up.
    const sub = AppState.addEventListener("change", (state) => state === "active" && void syncPending().catch(() => {}));
    void syncPending().catch(() => {});
    return () => {
      off();
      sub.remove();
    };
  }, []);

  if (signedIn === null) return <View style={{ flex: 1, backgroundColor: t.ground }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * 86_400_000 }}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.ground } }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="items/[id]" />
              <Stack.Screen name="lists/[id]" />
              <Stack.Screen name="welcome" options={{ presentation: "fullScreenModal" }} />
              <Stack.Screen name="settings" options={{ presentation: "modal" }} />
              <Stack.Screen name="pick" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1] }} />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="signin" />
            </Stack.Protected>
            <Stack.Screen name="oauth" />
          </Stack>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
