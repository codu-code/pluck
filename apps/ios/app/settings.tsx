import { LOCALE_NAMES } from "@pluck/i18n";
import type { AiConnection, Me, Settings as UserSettings } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActionSheetIOS, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { toast } from "@/components/Toast";
import { analyticsOn, loadConsent, onConsent, setConsent, type Consent } from "@/lib/analytics";
import { locale } from "@/lib/i18n";
import { kv } from "@/lib/kv";
import { keys, queryClient, useMe, useTags } from "@/lib/data";
import { api, getSession, signOut, type Session } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";
import { appIcons, type AppIcon } from "@/modules/app-icon";

const ICONS_SHOWN: { id: AppIcon; label: string; art: number }[] = [
  { id: "light", label: "Light", art: require("../assets/icon.png") },
  { id: "dark", label: "Dark", art: require("../assets/icon-dark.png") },
];
const EXPIRY: [string, UserSettings["expiryDays"]][] = [["14 days", 14], ["30 days", 30], ["60 days", 60], ["90 days", 90], ["Never", null]];
const SCOPES: [string, UserSettings["expiryScope"]][] = [["Inbox and Later", "inbox_later"], ["Inbox only", "inbox"]];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// One of a few choices from the system action sheet.
function choose(title: string, options: string[], done: (i: number) => void) {
  ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options, "Cancel"], cancelButtonIndex: options.length }, (i) => {
    if (i < options.length) done(i);
  });
}
const failed = (e: unknown) => Alert.alert("That did not go through", e instanceof Refused ? e.message : "Check the connection, then try again.");

// Settings (IOSSettings board): everything the web's Settings does, so the phone never needs it.
// Account things (AI tools, export, delete) need the "account" scope; a phone signed in before it asks to sign in again.
export default function Settings() {
  const tl = useTranslations("ios.language");
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const me = useMe();
  const tags = useTags();
  const tools = useQuery({ queryKey: ["aiTools"], queryFn: async () => (await api<{ tools: AiConnection[] }>("/api/v1/ai-tools")).tools, retry: false });
  const address = useQuery({ queryKey: ["emailIn"], queryFn: async () => (await api<{ address: string }>("/api/v1/email-in")).address });
  const [session, setSession] = useState<Session | null>(null);
  const [cache, setCache] = useState({ items: 0, bytes: 0 });
  const [copied, setCopied] = useState(false);
  const [icon, setIcon] = useState<AppIcon | null>(null);
  const [usage, setUsage] = useState<Consent | null>(null);

  useEffect(() => {
    void getSession().then(setSession);
    void kv.storage.getItem("queryCache").then((raw) => {
      const items = queryClient.getQueryCache().findAll({ queryKey: ["item"] }).length;
      setCache({ items, bytes: raw?.length ?? 0 });
    });
    if (appIcons.supported) void appIcons.get().then(setIcon);
    void loadConsent().then(setUsage);
    return onConsent(setUsage);
  }, []);

  const server = session?.server ?? "https://getpluck.io";
  const host = new URL(server).host;
  const profile = me.data;
  const settings = profile?.settings;
  const initials = ((profile?.name || profile?.email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("")) || "?";
  const needsAccount = tools.error instanceof Refused && tools.error.status === 403;

  const saveMe = async (body: { name?: string; settings?: Partial<UserSettings> }, said?: string) => {
    try {
      const res = await api<{ me: Me }>("/api/v1/me", { method: "PATCH", json: body });
      qc.setQueryData(keys.me, res.me);
      if (said) toast(said);
    } catch (e) {
      failed(e);
    }
  };
  const editName = () =>
    Alert.prompt("Your name", "Shown on Lists you make public.", [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: (v?: string) => void saveMe({ name: v ?? "" }, "Name saved.") },
    ], "plain-text", profile?.name ?? "");
  const disconnect = (tool: AiConnection) =>
    Alert.alert(`Disconnect ${tool.name}?`, "It stops reading and plucking straight away. Connect it again any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect", style: "destructive", onPress: async () => {
          await api("/api/v1/ai-tools/disconnect", { json: { clientId: tool.clientId } }).catch(failed);
          void tools.refetch();
        },
      },
    ]);
  const newAddress = () =>
    Alert.alert("A new address?", "The old one stops working at once. Update anything that forwards to it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "New address", onPress: async () => {
          const res = await api<{ address: string }>("/api/v1/email-in/regenerate", { method: "POST" }).catch(failed);
          if (res) qc.setQueryData(["emailIn"], res.address);
        },
      },
    ]);
  const exportAll = async () => {
    await api("/api/v1/export", { method: "POST" })
      .then(() => Alert.alert("Exporting", `A zip of everything is on its way to ${profile?.email ?? "your email"}. The link arrives in a minute or two.`))
      .catch(failed);
  };
  const deleteAll = () =>
    Alert.alert("Delete everything?", "Every item, tag, note and list, for good. Export first if you want a copy.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue", style: "destructive", onPress: () =>
          Alert.prompt("Type your email to confirm", profile?.email, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete everything", style: "destructive", onPress: async (typed?: string) => {
                try {
                  await api("/api/v1/me", { method: "DELETE", json: { confirm: typed ?? "" } });
                  await signOut();
                } catch (e) {
                  failed(e);
                }
              },
            },
          ], "plain-text", "", "email-address"),
      },
    ]);
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
  const footnote = (text: string) => <Text style={[font.regular, styles.footnote, { color: t.ink2 }]}>{text}</Text>;
  // A row of an inset group: label, then the value and a chevron when it opens something; they stack when the text is large.
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
  const pair = (name: string, shown: string) => (
    <>
      <Text style={label}>{name}</Text>
      <View style={styles.valueBox}>
        <Text style={value} numberOfLines={1}>{shown}</Text>
        <Icon d={ICONS.chevron} size={14} color={t.ink2} width={1.6} />
      </View>
    </>
  );
  const copyRow = (text: string, mono: boolean, onCopy: () => void, a11y: string) => (
    <View style={[styles.row, { borderBottomColor: t.tint, borderBottomWidth: StyleSheet.hairlineWidth * 2 }]}>
      <Text selectable style={[mono ? { fontFamily: "Menlo", fontSize: 13 } : [font.regular, { fontSize: 15 }], { color: t.ink, flexShrink: 1 }]}>{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onCopy} hitSlop={4} style={[styles.copy, { backgroundColor: t.brand }]}>
        <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.onBrand, fontSize: 14 }]}>Copy</Text>
      </Pressable>
    </View>
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
              <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{profile?.name || "Your account"}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{profile?.email ?? session?.email ?? ""}</Text>
            </View>
          </View>
          {row(pair("Name", profile?.name || "Add your name"), editName)}
          {row(pair("Handle", profile?.handle ? `@${profile.handle}` : ""), () => router.push({ pathname: "/handle", params: { host } }))}
          {row(<Text style={label}>Sign out</Text>, () => Alert.alert("Sign out?", "Plucks queued on this phone stay here until you sign in again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
          ]), true)}
        </View>
        {footnote("Your name and handle show on Lists you make public, and nowhere else.")}
      </View>

      <View style={styles.group}>
        {section("AI tools")}
        <View style={card}>
          {copyRow(`${host}/mcp`, true, async () => { await Clipboard.setStringAsync(`${server}/mcp`); setCopied(true); toast("Copied. Paste it into your AI."); }, copied ? "Copied" : "Copy the connector address")}
          {(tools.data ?? []).map((tool) => row(
            <>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={label}>{tool.name}</Text>
                <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>Connected {new Date(tool.connectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</Text>
              </View>
              <Text style={[font.regular, { color: t.danger, fontSize: 15 }]}>Disconnect</Text>
            </>,
            () => disconnect(tool),
            false,
            `${tool.name}. Disconnect`,
          ))}
          <Text style={[font.regular, styles.caption, { color: t.ink2 }]}>
            {needsAccount ? "Your connected AI tools show here once you sign in again with an email link."
              : tools.data?.length === 0 ? "No AI tool connected yet. Add the address once in your AI tool; it works on every device you use it on."
                : "Add the address once in your AI tool. It works on every device you use it on."}
          </Text>
        </View>
      </View>

      <View style={styles.group}>
        {section("Email in")}
        <View style={card}>
          {address.data ? copyRow(address.data, false, async () => { await Clipboard.setStringAsync(address.data!); toast("Address copied."); }, "Copy the email-in address") : null}
          {row(<Text style={[font.regular, styles.label, { color: t.actionInk }]}>New address</Text>, newAddress, true)}
        </View>
        {footnote("Forward a newsletter here. It lands in the Inbox as a Read item.")}
      </View>

      {settings && (
        <View style={styles.group}>
          {section("Expiry and the weekly email")}
          <View style={card}>
            {row(pair("Move to the Archive after", EXPIRY.find(([, d]) => d === settings.expiryDays)?.[0] ?? "Never"), () =>
              choose("Untouched items move to the Archive after", EXPIRY.map(([n]) => n), (i) => {
                const days = EXPIRY[i]![1];
                void saveMe({ settings: { expiryDays: days } }, days ? `Untouched for ${days} days goes to the Archive. Nothing is deleted.` : "Nothing expires now.");
              }))}
            {row(pair("Applies to", SCOPES.find(([, s]) => s === settings.expiryScope)?.[0] ?? ""), () =>
              choose("Expiry applies to", SCOPES.map(([n]) => n), (i) => void saveMe({ settings: { expiryScope: SCOPES[i]![1] } })))}
            {row(pair("Weekly email", settings.digestDay === null ? "Off" : DAYS[settings.digestDay]!), () =>
              choose("Send the weekly email on", [...DAYS, "Off"], (i) => {
                const day = i < 7 ? i : null;
                void saveMe({ settings: { digestDay: day } }, day === null ? "No weekly email." : `The weekly email comes on ${DAYS[day]}s.`);
              }), true)}
          </View>
          {footnote("Untouched items move to the Archive, nothing is deleted. The weekly email: what moves soon, what is due, and things you plucked and forgot.")}
        </View>
      )}

      <View style={styles.group}>
        {section("Library")}
        <View style={card}>
          {row(pair("Tags", `${tags.data?.length ?? ""}`), () => router.push("/tags"))}
          {row(pair("Export everything", "By email"), () => void exportAll())}
          {row(<><Text style={label}>Offline copy</Text><Text style={value}>{cache.items} {cache.items === 1 ? "item" : "items"} · {Math.max(1, Math.round(cache.bytes / 1_000_000))} MB</Text></>, () =>
            Alert.alert("Clear the offline copy?", "Your library stays on the server. The app downloads it again as you use it.", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", onPress: () => { queryClient.clear(); void kv.remove("queryCache"); setCache({ items: 0, bytes: 0 }); } },
            ]))}
          {row(<><Text style={label}>Server</Text><Text style={value}>{host}</Text></>, () =>
            Alert.alert("Server", `This phone uses ${host}. To use another server, sign out, then choose "Use your own server".`), true)}
        </View>
      </View>

      {/* iOS keeps a language per app (Settings, Pluck, Language); changing it restarts Pluck in that language. */}
      <View style={styles.group}>
        {section(tl("label"))}
        <View style={card}>{row(pair(LOCALE_NAMES[locale], ""), () => void Linking.openSettings(), true)}</View>
        {footnote(tl("hint"))}
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
          {footnote("Just the icon. The app itself follows your phone.")}
        </View>
      )}

      {analyticsOn && (
        <View style={styles.group}>
          {section("Privacy")}
          <View style={card}>
            <View style={[styles.switchRow]}>
              <Text style={[label, { flex: 1 }]}>Share how I use Pluck</Text>
              <Switch accessibilityLabel="Share how I use Pluck" value={usage === "yes"} onValueChange={(on) => void setConsent(on ? "yes" : "no")} trackColor={{ true: t.accent }} />
            </View>
          </View>
          {footnote("Which screens you use, tied to your account. Never what you pluck. Crash reports go either way, without your name.")}
        </View>
      )}

      <View style={[styles.tip, { backgroundColor: t.surface }]}>
        <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>Put Pluck first in Share</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>In any app, tap Share, scroll the app row to More, and drag Pluck to the front.</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={deleteAll} style={[styles.delete, { backgroundColor: t.surface }]}>
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
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingHorizontal: 16, paddingVertical: 8 },
  account: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 48, paddingVertical: 10, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 2, paddingHorizontal: 14 },
  label: { fontSize: 15 },
  value: { fontSize: 15, flexShrink: 1 },
  valueBox: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  copy: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8, justifyContent: "center" },
  caption: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 13 },
  iconRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 14 },
  iconPreview: { width: 40, height: 40, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth },
  footnote: { paddingHorizontal: 12, fontSize: 13, lineHeight: 18 },
  tip: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 12 },
  delete: { marginTop: 8, minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
