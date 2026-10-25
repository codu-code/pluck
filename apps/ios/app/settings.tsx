import { LOCALE_NAMES } from "@pluck/i18n";
import type { AiConnection, Me, Settings as UserSettings } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActionSheetIOS, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFormatter, useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { toast } from "@/components/Toast";
import { analyticsOn, loadConsent, onConsent, setConsent, type Consent } from "@/lib/analytics";
import { locale } from "@/lib/i18n";
import { kv } from "@/lib/kv";
import { keys, queryClient, useMe, useTags } from "@/lib/data";
import { api, getSession, signOut, type Session } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";
import { appIcons, type AppIcon } from "@/modules/app-icon";

const ICONS_SHOWN: { id: AppIcon; label: "iconLight" | "iconDark"; art: number }[] = [
  { id: "light", label: "iconLight", art: require("../assets/icon.png") },
  { id: "dark", label: "iconDark", art: require("../assets/icon-dark.png") },
];
const EXPIRY: UserSettings["expiryDays"][] = [14, 30, 60, 90, null];
const SCOPES: ["scopeInboxLater" | "scopeInbox", UserSettings["expiryScope"]][] = [["scopeInboxLater", "inbox_later"], ["scopeInbox", "inbox"]];

// Settings (IOSSettings board): everything the web's Settings does, so the phone never needs it.
// Account things (AI tools, export, delete) need the "account" scope; a phone signed in before it asks to sign in again.
export default function Settings() {
  const tl = useTranslations("ios.language");
  const tc = useTranslations("ios.common");
  const tr = useTranslations("ios.settings");
  const format = useFormatter();
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
  // Sunday first, as digestDay counts: 7 Jan 2024 was a Sunday.
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => format.dateTime(new Date(2024, 0, 7 + d), { weekday: "long" }));
  const expiryName = (d: UserSettings["expiryDays"]) => (d ? tr("days", { count: d }) : tr("never"));
  const scope = SCOPES.find(([, s]) => s === settings?.expiryScope)?.[0];

  // One of a few choices from the system action sheet.
  const choose = (title: string, options: string[], done: (i: number) => void) =>
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options, tc("cancel")], cancelButtonIndex: options.length }, (i) => {
      if (i < options.length) done(i);
    });
  const failed = (e: unknown) => Alert.alert(tc("failed.title"), e instanceof Refused ? e.message : tc("failed.body"));

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
    Alert.prompt(tr("nameTitle"), tr("nameBody"), [
      { text: tc("cancel"), style: "cancel" },
      { text: tc("save"), onPress: (v?: string) => void saveMe({ name: v ?? "" }, tr("nameSaved")) },
    ], "plain-text", profile?.name ?? "");
  const disconnect = (tool: AiConnection) =>
    Alert.alert(tr("disconnectTitle", { name: tool.name }), tr("disconnectBody"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: tr("disconnect"), style: "destructive", onPress: async () => {
          await api("/api/v1/ai-tools/disconnect", { json: { clientId: tool.clientId } }).catch(failed);
          void tools.refetch();
        },
      },
    ]);
  const newAddress = () =>
    Alert.alert(tr("newAddressTitle"), tr("newAddressBody"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: tr("newAddress"), onPress: async () => {
          const res = await api<{ address: string }>("/api/v1/email-in/regenerate", { method: "POST" }).catch(failed);
          if (res) qc.setQueryData(["emailIn"], res.address);
        },
      },
    ]);
  const exportAll = async () => {
    await api("/api/v1/export", { method: "POST" })
      .then(() => Alert.alert(tr("exportingTitle"), profile?.email ? tr("exportingBody", { email: profile.email }) : tr("exportingBodyNoEmail")))
      .catch(failed);
  };
  const deleteAll = () =>
    Alert.alert(tr("deleteTitle"), tr("deleteBody"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: tr("continue"), style: "destructive", onPress: () =>
          Alert.prompt(tr("confirmTitle"), profile?.email, [
            { text: tc("cancel"), style: "cancel" },
            {
              text: tr("deleteButton"), style: "destructive", onPress: async (typed?: string) => {
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
        <Text maxFontSizeMultiplier={scale.title} style={[font.regular, { color: t.onBrand, fontSize: 14 }]}>{tc("copy")}</Text>
      </Pressable>
    </View>
  );

  return (
    // A sheet: it already sits below the status bar, so no top inset.
    <ScrollView style={{ backgroundColor: t.rail }} contentContainerStyle={[styles.page, { paddingTop: 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.bold, styles.title, { color: t.ink }]}>{tr("title")}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.done}>
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{tc("done")}</Text>
        </Pressable>
      </View>

      <View style={styles.group}>
        {section(tr("sections.account"))}
        <View style={card}>
          <View style={[styles.account, { borderBottomColor: t.tint }]}>
            <View style={[styles.avatar, { backgroundColor: t.avatar }]}><Text maxFontSizeMultiplier={scale.badge} style={[font.semibold, { color: t.ink, fontSize: 13 }]}>{initials}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{profile?.name || tr("yourAccount")}</Text>
              <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{profile?.email ?? session?.email ?? ""}</Text>
            </View>
          </View>
          {row(pair(tr("name"), profile?.name || tr("addName")), editName)}
          {row(pair(tr("handle"), profile?.handle ? `@${profile.handle}` : ""), () => router.push({ pathname: "/handle", params: { host } }))}
          {row(<Text style={label}>{tr("signOut")}</Text>, () => Alert.alert(tr("signOutTitle"), tr("signOutBody"), [
            { text: tc("cancel"), style: "cancel" },
            { text: tr("signOut"), style: "destructive", onPress: () => void signOut() },
          ]), true)}
        </View>
        {footnote(tr("accountFootnote"))}
      </View>

      <View style={styles.group}>
        {section(tr("sections.aiTools"))}
        <View style={card}>
          {copyRow(`${host}/mcp`, true, async () => { await Clipboard.setStringAsync(`${server}/mcp`); setCopied(true); toast(tr("connectorCopied")); }, copied ? tr("copied") : tr("copyConnector"))}
          {(tools.data ?? []).map((tool) => row(
            <>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={label}>{tool.name}</Text>
                <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{tr("connected", { date: format.dateTime(new Date(tool.connectedAt), { day: "numeric", month: "short" }) })}</Text>
              </View>
              <Text style={[font.regular, { color: t.danger, fontSize: 15 }]}>{tr("disconnect")}</Text>
            </>,
            () => disconnect(tool),
            false,
            tr("disconnectA11y", { name: tool.name }),
          ))}
          <Text style={[font.regular, styles.caption, { color: t.ink2 }]}>
            {tr(needsAccount ? "toolsNeedAccount" : tools.data?.length === 0 ? "toolsNone" : "toolsHint")}
          </Text>
        </View>
      </View>

      <View style={styles.group}>
        {section(tr("sections.emailIn"))}
        <View style={card}>
          {address.data ? copyRow(address.data, false, async () => { await Clipboard.setStringAsync(address.data!); toast(tr("addressCopied")); }, tr("copyEmailIn")) : null}
          {row(<Text style={[font.regular, styles.label, { color: t.actionInk }]}>{tr("newAddress")}</Text>, newAddress, true)}
        </View>
        {footnote(tr("emailInFootnote"))}
      </View>

      {settings && (
        <View style={styles.group}>
          {section(tr("sections.expiry"))}
          <View style={card}>
            {row(pair(tr("moveAfter"), expiryName(EXPIRY.includes(settings.expiryDays) ? settings.expiryDays : null)), () =>
              choose(tr("moveAfterTitle"), EXPIRY.map(expiryName), (i) => {
                const n = EXPIRY[i]!;
                void saveMe({ settings: { expiryDays: n } }, n ? tr("expirySaved", { count: n }) : tr("noExpiry"));
              }))}
            {row(pair(tr("appliesTo"), scope ? tr(scope) : ""), () =>
              choose(tr("appliesToTitle"), SCOPES.map(([n]) => tr(n)), (i) => void saveMe({ settings: { expiryScope: SCOPES[i]![1] } })))}
            {row(pair(tr("weekly"), settings.digestDay === null ? tr("off") : days[settings.digestDay]!), () =>
              choose(tr("weeklyTitle"), [...days, tr("off")], (i) => {
                const day = i < 7 ? i : null;
                void saveMe({ settings: { digestDay: day } }, day === null ? tr("noWeekly") : tr("weeklyOn", { day: String(day) }));
              }), true)}
          </View>
          {footnote(tr("expiryFootnote"))}
        </View>
      )}

      <View style={styles.group}>
        {section(tr("sections.library"))}
        <View style={card}>
          {row(pair(tr("tags"), `${tags.data?.length ?? ""}`), () => router.push("/tags"))}
          {row(pair(tr("export"), tr("byEmail")), () => void exportAll())}
          {row(<><Text style={label}>{tr("offline")}</Text><Text style={value}>{tr("offlineValue", { count: cache.items, mb: Math.max(1, Math.round(cache.bytes / 1_000_000)) })}</Text></>, () =>
            Alert.alert(tr("clearTitle"), tr("clearBody"), [
              { text: tc("cancel"), style: "cancel" },
              { text: tr("clear"), onPress: () => { queryClient.clear(); void kv.remove("queryCache"); setCache({ items: 0, bytes: 0 }); } },
            ]))}
          {row(<><Text style={label}>{tr("server")}</Text><Text style={value}>{host}</Text></>, () =>
            Alert.alert(tr("server"), tr("serverBody", { host })), true)}
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
          {section(tr("sections.appIcon"))}
          <View style={card} accessibilityRole="radiogroup">
            {ICONS_SHOWN.map((o, i) => (
              <Pressable
                key={o.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: icon === o.id }}
                accessibilityLabel={tr("iconA11y", { name: tr(o.label) })}
                onPress={() => void chooseIcon(o.id)}
                style={({ pressed }) => [styles.iconRow, { borderBottomColor: t.tint, borderBottomWidth: i === ICONS_SHOWN.length - 1 ? 0 : StyleSheet.hairlineWidth * 2, backgroundColor: pressed ? t.selected : "transparent" }]}
              >
                <Image source={o.art} style={[styles.iconPreview, { borderColor: t.line }]} accessibilityIgnoresInvertColors />
                <Text style={[label, { flex: 1 }]}>{tr(o.label)}</Text>
                {icon === o.id && <Icon d={ICONS.tick} size={18} color={t.actionInk} width={2} />}
              </Pressable>
            ))}
          </View>
          {footnote(tr("iconFootnote"))}
        </View>
      )}

      {analyticsOn && (
        <View style={styles.group}>
          {section(tr("sections.privacy"))}
          <View style={card}>
            <View style={[styles.switchRow]}>
              <Text style={[label, { flex: 1 }]}>{tr("usage")}</Text>
              <Switch accessibilityLabel={tr("usage")} value={usage === "yes"} onValueChange={(on) => void setConsent(on ? "yes" : "no")} trackColor={{ true: t.accent }} />
            </View>
          </View>
          {footnote(tr("usageFootnote"))}
        </View>
      )}

      <View style={[styles.tip, { backgroundColor: t.surface }]}>
        <Image source={require("../assets/icon.png")} style={{ width: 36, height: 36, borderRadius: 8 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[font.semibold, { color: t.ink, fontSize: 15 }]}>{tr("tipTitle")}</Text>
          <Text style={[font.regular, { color: t.ink2, fontSize: 13, lineHeight: 18 }]}>{tr("tipBody")}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={deleteAll} style={[styles.delete, { backgroundColor: t.surface }]}>
        <Text style={[font.medium, { color: t.danger, fontSize: 15, textAlign: "center" }]}>{tr("deleteAll")}</Text>
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
