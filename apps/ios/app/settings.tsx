import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kv } from "@/lib/kv";
import { queryClient, useMe, useTags } from "@/lib/data";
import { getSession, signOut, type Session } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// Settings (IOSSettings board). What only the web does (handle, tags, deleting the account) opens it in Safari.
export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const tags = useTags();
  const [session, setSession] = useState<Session | null>(null);
  const [cache, setCache] = useState({ items: 0, bytes: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void getSession().then(setSession);
    void kv.storage.getItem("queryCache").then((raw) => {
      const items = queryClient.getQueryCache().findAll({ queryKey: ["item"] }).length;
      setCache({ items, bytes: raw?.length ?? 0 });
    });
  }, []);

  const server = session?.server ?? "https://getpluck.io";
  const host = new URL(server).host;
  const web = (path: string) => void WebBrowser.openBrowserAsync(`${server}${path}`);
  const initials = ((me.data?.name || me.data?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")) || "?";

  const card = [styles.card, { backgroundColor: t.surface }];
  const row = [styles.row, { borderBottomColor: t.tint }];
  const label = [font.regular, { color: t.ink, fontSize: 15 }];
  const value = [font.regular, { color: t.ink2, fontSize: 15 }];
  const section = (title: string) => <Text style={[font.regular, styles.section, { color: t.ink2 }]}>{title.toUpperCase()}</Text>;

  return (
    // A sheet: it already sits below the status bar, so no top inset.
    <ScrollView style={{ backgroundColor: t.rail }} contentContainerStyle={[styles.page, { paddingTop: 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[font.bold, styles.title, { color: t.ink }]}>Settings</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}><Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>Done</Text></Pressable>
      </View>

      <View style={styles.group}>
        {section("Account")}
        <View style={card}>
          <View style={[styles.account, { borderBottomColor: t.tint }]}>
            <View style={[styles.avatar, { backgroundColor: t.avatar }]}><Text style={[font.semibold, { color: t.ink, fontSize: 13 }]}>{initials}</Text></View>
            <View>
              <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{me.data?.name || "Your account"}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{me.data?.email ?? session?.email ?? ""}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => web("/settings")} style={row}>
            <Text style={label}>Handle</Text><Text style={value}>{me.data?.handle ? `@${me.data.handle}` : "Not set"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert("Sign out?", "Plucks queued on this phone stay here until you sign in again.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void signOut() },
            ])}
          >
            <Text style={label}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.group}>
        {section("AI tools")}
        <View style={card}>
          <View style={row}>
            <Text style={[{ fontFamily: "Menlo", fontSize: 13, color: t.ink }]}>{host}/mcp</Text>
            <Pressable
              accessibilityRole="button"
              onPress={async () => { await Clipboard.setStringAsync(`${server}/mcp`); setCopied(true); }}
              style={[styles.copy, { backgroundColor: t.brand }]}
            >
              <Text style={[font.regular, { color: t.onBrand, fontSize: 14 }]}>{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>
          <Text style={[font.regular, styles.caption, { color: t.ink2 }]}>Add it once in your AI tool. It works on every device you use it on.</Text>
        </View>
      </View>

      <View style={styles.group}>
        {section("Library")}
        <View style={card}>
          <Pressable accessibilityRole="button" onPress={() => web("/settings#tags")} style={row}>
            <Text style={label}>Tags</Text><Text style={value}>{tags.data?.length ?? ""}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={row}
            onPress={() => Alert.alert("Clear the offline copy?", "Your library stays on the server. The app downloads it again as you use it.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", onPress: () => { queryClient.clear(); void kv.remove("queryCache"); setCache({ items: 0, bytes: 0 }); } },
            ])}
          >
            <Text style={label}>Offline cache</Text>
            <Text style={value}>{cache.items} items · {Math.max(1, Math.round(cache.bytes / 1_000_000))} MB</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.row, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert("Server", `This phone uses ${host}. To use another server, sign out, then choose "Use your own server".`)}
          >
            <Text style={label}>Server</Text><Text style={value}>{host} · Advanced</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.tip, { backgroundColor: t.surface }]}>
        <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>Put Pluck first in Share</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>In any app, tap Share, scroll the app row to More, and drag Pluck to the front.</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => web("/settings#delete")} style={[styles.delete, { backgroundColor: t.surface }]}>
        <Text style={[font.medium, { color: t.danger, fontSize: 15 }]}>Delete everything. No, really.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 22 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  done: { height: 44, justifyContent: "center", paddingHorizontal: 4 },
  group: { gap: 6 },
  section: { paddingHorizontal: 12, fontSize: 12, letterSpacing: 0.6 },
  card: { borderRadius: 12, overflow: "hidden" },
  account: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  row: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  copy: { height: 36, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  caption: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 13 },
  tip: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12 },
  delete: { marginTop: 8, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
