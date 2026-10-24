import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, ICONS } from "@/components/Glyph";
import { kv } from "@/lib/kv";
import { queryClient, useMe, useTags } from "@/lib/data";
import { getSession, signOut, type Session } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";
import { appIcons, type AppIcon } from "@/modules/app-icon";

const ICONS_SHOWN: { id: AppIcon; label: string; art: number }[] = [
  { id: "light", label: "Light", art: require("../assets/icon.png") },
  { id: "dark", label: "Dark", art: require("../assets/icon-dark.png") },
];

// Settings (IOSSettings board). What only the web does (handle, tags, deleting the account) opens it in Safari.
export default function Settings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const tags = useTags();
  const [session, setSession] = useState<Session | null>(null);
  const [cache, setCache] = useState({ items: 0, bytes: 0 });
  const [copied, setCopied] = useState(false);
  const [icon, setIcon] = useState<AppIcon | null>(null);

  useEffect(() => {
    void getSession().then(setSession);
    void kv.storage.getItem("queryCache").then((raw) => {
      const items = queryClient.getQueryCache().findAll({ queryKey: ["item"] }).length;
      setCache({ items, bytes: raw?.length ?? 0 });
    });
    if (appIcons.supported) void appIcons.get().then(setIcon);
  }, []);

  const server = session?.server ?? "https://getpluck.io";
  const host = new URL(server).host;
  const web = (path: string) => void WebBrowser.openBrowserAsync(`${server}${path}`);
  const initials = ((me.data?.name || me.data?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")) || "?";

  const chooseIcon = async (next: AppIcon) => {
    if (next === icon) return;
    const was = icon;
    setIcon(next);
    // iOS confirms the change with its own alert. If it refuses (it can, mid-transition), put the tick back.
    await appIcons.set(next).catch(() => setIcon(was));
  };

  const card = [styles.card, { backgroundColor: t.surface }];
  const label = [font.regular, styles.label, { color: t.ink }];
  const value = [font.regular, styles.value, { color: t.ink2 }];
  const section = (title: string) => <Text accessibilityRole="header" style={[font.regular, styles.section, { color: t.ink2 }]}>{title.toUpperCase()}</Text>;
  // A row of an inset group: label, then the value; they stack when the text is large.
  const row = (children: ReactNode, onPress: (() => void) | undefined, last = false, a11y?: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: t.tint, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth * 2, backgroundColor: pressed ? t.selected : "transparent" }]}
    >
      {children}
    </Pressable>
  );

  return (
    // A sheet: it already sits below the status bar, so no top inset.
    <ScrollView style={{ backgroundColor: t.rail }} contentContainerStyle={[styles.page, { paddingTop: 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.bold, styles.title, { color: t.ink }]}>Settings</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 15 }]}>Done</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        {section("Account")}
        <View style={card}>
          <View style={[styles.account, { borderBottomColor: t.tint }]}>
            <View style={[styles.avatar, { backgroundColor: t.avatar }]}><Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: t.ink, fontSize: 13 }]}>{initials}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{me.data?.name || "Your account"}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{me.data?.email ?? session?.email ?? ""}</Text>
            </View>
          </View>
          {row(<><Text style={label}>Handle</Text><Text style={value}>{me.data?.handle ? `@${me.data.handle}` : "Not set"}</Text></>, () => web("/settings"))}
          {row(<Text style={label}>Sign out</Text>, () => Alert.alert("Sign out?", "Plucks queued on this phone stay here until you sign in again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
          ]), true)}
        </View>
      </View>

      <View style={styles.group}>
        {section("AI tools")}
        <View style={card}>
          <View style={[styles.row, { borderBottomColor: t.tint, borderBottomWidth: StyleSheet.hairlineWidth * 2 }]}>
            <Text selectable style={[{ fontFamily: "Menlo", fontSize: 13, color: t.ink, flexShrink: 1 }]}>{host}/mcp</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copied ? "Copied" : "Copy the connector address"}
              onPress={async () => { await Clipboard.setStringAsync(`${server}/mcp`); setCopied(true); }}
              hitSlop={4}
              style={[styles.copy, { backgroundColor: t.brand }]}
            >
              <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.onBrand, fontSize: 14 }]}>{copied ? "Copied" : "Copy"}</Text>
            </Pressable>
          </View>
          <Text style={[font.regular, styles.caption, { color: t.ink2 }]}>Add it once in your AI tool. It works on every device you use it on.</Text>
        </View>
      </View>

      <View style={styles.group}>
        {section("Library")}
        <View style={card}>
          {row(<><Text style={label}>Tags</Text><Text style={value}>{tags.data?.length ?? ""}</Text></>, () => web("/settings#tags"))}
          {row(<><Text style={label}>Offline cache</Text><Text style={value}>{cache.items} {cache.items === 1 ? "item" : "items"} · {Math.max(1, Math.round(cache.bytes / 1_000_000))} MB</Text></>, () =>
            Alert.alert("Clear the offline copy?", "Your library stays on the server. The app downloads it again as you use it.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", onPress: () => { queryClient.clear(); void kv.remove("queryCache"); setCache({ items: 0, bytes: 0 }); } },
            ]))}
          {row(<><Text style={label}>Server</Text><Text style={value}>{host} · Advanced</Text></>, () =>
            Alert.alert("Server", `This phone uses ${host}. To use another server, sign out, then choose "Use your own server".`), true)}
        </View>
      </View>

      {appIcons.supported && icon && (
        <View style={styles.group}>
          {section("App icon")}
          <View style={card} accessibilityRole="radiogroup">
            {ICONS_SHOWN.map((o, i) => (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: icon === o.id }}
                accessibilityLabel={`${o.label} icon`}
                onPress={() => void chooseIcon(o.id)}
                style={({ pressed }) => [styles.iconRow, { borderBottomColor: t.tint, borderBottomWidth: i === ICONS_SHOWN.length - 1 ? 0 : StyleSheet.hairlineWidth * 2, backgroundColor: pressed ? t.selected : "transparent" }]}
              >
                <Image source={o.art} style={[styles.iconPreview, { borderColor: t.line }]} accessibilityIgnoresInvertColors />
                <Text style={[label, { flex: 1 }]}>{o.label}</Text>
                {icon === o.id && <Icon d={ICONS.tick} size={18} color={t.actionInk} width={2} />}
              </Pressable>
            ))}
          </View>
          <Text style={[font.regular, styles.footnote, { color: t.ink2 }]}>Just the icon. The app itself follows your phone.</Text>
        </View>
      )}

      <View style={[styles.tip, { backgroundColor: t.surface }]}>
        <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>Put Pluck first in Share</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>In any app, tap Share, scroll the app row to More, and drag Pluck to the front.</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => web("/settings#delete")} style={[styles.delete, { backgroundColor: t.surface }]}>
        <Text style={[font.medium, { color: t.danger, fontSize: 15, textAlign: "center" }]}>Delete everything. No, really.</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, gap: 22 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.84 },
  done: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: 4 },
  group: { gap: 6 },
  section: { paddingHorizontal: 12, fontSize: 12, letterSpacing: 0.6 },
  card: { borderRadius: 12, overflow: "hidden" },
  account: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 48, paddingVertical: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 2, paddingHorizontal: 14 },
  label: { fontSize: 15 },
  value: { fontSize: 15, flexShrink: 1 },
  copy: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  caption: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 13 },
  iconRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  iconPreview: { width: 40, height: 40, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth },
  footnote: { paddingHorizontal: 12, fontSize: 13, lineHeight: 18 },
  tip: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12 },
  delete: { marginTop: 8, minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
