import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, LogBox, Settings, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { IntlProvider } from "use-intl";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastHost } from "@/components/Toast";
import { UsagePrompt } from "@/components/UsagePrompt";
import { forgetUser, identify, onConsent, screen } from "@/lib/analytics";
import { formatLocale } from "@pluck/i18n";
import { locale, messages, timeZone } from "@/lib/i18n";
import { clearKept, keepForOffline, queryClient, syncPending, useMe } from "@/lib/data";
import { kv } from "@/lib/kv";
import { defaultServer, getSession, isSignedIn, onSession, signInWithKey } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { appIcons, type AppIcon } from "@/modules/app-icon";

// Two known dev-only warnings that covered the bottom of every screen: React Native's no-op one for a native-driven
// value with no JS listener, and expo-linking noting the second scheme (the OAuth redirect, on purpose).
LogBox.ignoreLogs(["Sending `onAnimatedValueUpdate` with no listeners registered.", "Linking found multiple possible URI schemes"]);

const persister = createAsyncStoragePersister({ storage: kv.storage, key: "queryCache" });

// The launch screen stays until we know which screen to open, then fades into it.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

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
      // …and the home screen icon (-demoIcon dark), to check the alternate icon without tapping through Settings.
      const icon = demoKey ? (Settings.get("demoIcon") as AppIcon | undefined) : undefined;
      if (icon) void appIcons.set(icon).catch(() => {});
      // …and no connection (-demoOffline 1), for the Offline pill: the Simulator shares the Mac's network.
      if (demoKey && Settings.get("demoOffline")) onlineManager.setOnline(false);
    })();
    const off = onSession((s) => {
      setSignedIn(Boolean(s?.access || s?.apiKey));
      if (!s) {
        queryClient.clear();
        void clearKept();
        forgetUser();
      }
    });
    // Coming back to the app, or the connection coming back, is when queued plucks (from the app or the share sheet)
    // go up and, on Wi-Fi, the newest Items are kept for offline reading.
    const catchUp = () => {
      void syncPending().catch(() => {});
      void keepForOffline();
    };
    const sub = AppState.addEventListener("change", (state) => state === "active" && catchUp());
    const net = onlineManager.subscribe((online) => online && catchUp());
    catchUp();
    return () => {
      off();
      sub.remove();
      net();
    };
  }, []);

  useEffect(() => {
    if (signedIn !== null) SplashScreen.hide();
  }, [signedIn]);

  if (signedIn === null) return <View style={{ flex: 1, backgroundColor: t.ground }} />;
  return (
    <IntlProvider locale={formatLocale(locale)} messages={messages} timeZone={timeZone}>
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
                <Stack.Screen name="note" options={{ presentation: "modal" }} />
                <Stack.Screen name="handle" options={{ presentation: "modal" }} />
                <Stack.Screen name="tags" options={{ presentation: "modal" }} />
                <Stack.Screen name="share" options={{ presentation: "modal" }} />
                <Stack.Screen name="shared/[id]" />
                <Stack.Screen name="pick" options={{ presentation: "formSheet", sheetAllowedDetents: [0.6, 1] }} />
              </Stack.Protected>
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="signin" />
              </Stack.Protected>
            </Stack>
            <Screens />
            {signedIn && <SignedInAnalytics />}
            <ToastHost />
          </PersistQueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </IntlProvider>
  );
}

// Each route as a screen view (lib/analytics.ts sends them only after a yes).
function Screens() {
  const path = usePathname();
  useEffect(() => screen(path), [path]);
  return null;
}

// Ties usage to the account once they said yes, and asks the question once.
function SignedInAnalytics() {
  const me = useMe();
  const id = me.data?.id;
  useEffect(() => {
    if (!id) return;
    identify(id);
    return onConsent(() => identify(id));
  }, [id]);
  return <UsagePrompt />;
}
