import type { ListShare } from "@pluck/shared-schemas";
import { Refused } from "@pluck/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { Icon, ICONS } from "@/components/Glyph";
import { toast } from "@/components/Toast";
import { keys, useList, useMe } from "@/lib/data";
import { api, getSession } from "@/lib/session";
import { font, scale, useTheme } from "@/lib/theme";

type Access = "me" | "people" | "anyone";

// Sharing a List (no board: after Claude's share sheet). What is shared at the top, one choice of who has access,
// what they see, and the link to send. People you choose get an email; Anyone with the link makes it public.
export default function ShareList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const tr = useTranslations("ios");
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const data = useList(id);
  const me = useMe();
  const people = useQuery({ queryKey: ["people", id], queryFn: async () => (await api<{ people: ListShare[] }>(`/api/v1/lists/${id}/people`)).people });
  const list = data.data?.list;
  const [picked, setPicked] = useState<Access | null>(null); // "People you choose" before anyone is added
  const access: Access = list?.visibility === "public" ? "anyone" : (people.data?.length ? "people" : (picked ?? "me"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<Access | "add" | null>(null);
  const [server, setServer] = useState("https://getpluck.io");
  useEffect(() => void getSession().then((x) => x && setServer(x.server)), []);
  const publicUrl = list && me.data?.handle ? `${server}/@${me.data.handle}/${list.slug}` : null;

  const failed = (e: unknown) => Alert.alert(tr("common.failed.title"), e instanceof Refused ? e.message : tr("common.failed.body"));
  const settle = async () => {
    await Promise.all([data.refetch(), people.refetch()]);
    void qc.invalidateQueries({ queryKey: keys.lists });
  };
  const visibility = (v: "private" | "public") => api(`/api/v1/lists/${id}`, { method: "PATCH", json: { visibility: v } });
  const unshareAll = () => Promise.all((people.data ?? []).map((p) => api(`/api/v1/lists/${id}/people/${p.id}`, { method: "DELETE" })));

  const choose = async (next: Access) => {
    if (next === access || busy) return;
    const go = async () => {
      setBusy(next);
      try {
        if (next === "anyone") await visibility("public");
        else if (list?.visibility === "public") await visibility("private");
        if (next === "me") await unshareAll();
        setPicked(next);
        await settle();
      } catch (e) {
        failed(e);
      }
      setBusy(null);
    };
    const n = people.data?.length ?? 0;
    if (next === "me" && n) {
      return Alert.alert(tr("share.stopManyTitle", { count: n }), tr("share.stopManyBody"), [
        { text: tr("common.cancel"), style: "cancel" },
        { text: tr("share.stopSharing"), style: "destructive", onPress: () => void go() },
      ]);
    }
    if (next === "anyone") {
      return Alert.alert(tr("share.anyoneTitle"), tr("share.anyoneBody"), [
        { text: tr("common.cancel"), style: "cancel" },
        { text: tr("share.makePublic"), onPress: () => void go() },
      ]);
    }
    await go();
  };

  const add = async () => {
    if (!email.trim()) return;
    setBusy("add");
    try {
      const { person } = await api<{ person: ListShare }>(`/api/v1/lists/${id}/people`, { json: { email } });
      setEmail("");
      toast(tr("share.sharedWith", { email: person.email }));
      await settle();
    } catch (e) {
      failed(e);
    }
    setBusy(null);
  };
  const remove = (p: ListShare) =>
    Alert.alert(tr("share.stopOneTitle", { email: p.email }), tr("share.stopOneBody"), [
      { text: tr("common.cancel"), style: "cancel" },
      { text: tr("share.stopSharing"), style: "destructive", onPress: () => void api(`/api/v1/lists/${id}/people/${p.id}`, { method: "DELETE" }).then(settle).catch(failed) },
    ]);

  const off = access === "me" || (access === "people" && !people.data?.length); // nothing to send yet
  const shareLink = () => {
    if (!list || off) return;
    // People get theirs by email too; this is the same link, for a message. It opens only for them.
    void Share.share({ url: access === "anyone" && publicUrl ? publicUrl : `${server}/shared/${list.id}` });
  };

  const options: { key: Access; icon: string }[] = [
    { key: "me", icon: ICONS.lock },
    { key: "people", icon: ICONS.people },
    { key: "anyone", icon: ICONS.globe },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.rail }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel={tr("share.close")} onPress={() => router.back()} style={[styles.close, { backgroundColor: t.surface }]}>
          <Icon d={ICONS.close} size={16} color={t.ink} width={1.8} />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 17 }]}>{tr("share.title")}</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.page, { paddingBottom: 24 }]}>
        {/* What is being shared. */}
        <View style={[styles.what, { backgroundColor: t.surface }]}>
          <Icon d={ICONS.lists} size={20} color={t.ink} width={1.5} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={2} style={[font.semibold, { color: t.ink, fontSize: 16 }]}>{list?.name ?? " "}</Text>
            {list ? <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{tr("common.items", { count: list.itemCount })}</Text> : null}
          </View>
        </View>

        <Text style={[font.regular, styles.section, { color: t.ink2 }]}>{tr("share.whoHasAccess")}</Text>
        <View style={[styles.card, { backgroundColor: t.surface }]} accessibilityRole="radiogroup">
          {options.map((o, i) => (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: access === o.key, busy: busy === o.key }}
              onPress={() => void choose(o.key)}
              style={({ pressed }) => [styles.option, { borderBottomColor: t.tint, borderBottomWidth: i < options.length - 1 ? StyleSheet.hairlineWidth * 2 : 0, backgroundColor: pressed ? t.selected : "transparent" }]}
            >
              <Icon d={o.icon} size={20} color={t.ink} width={1.5} />
              <Text style={[font.regular, { flex: 1, color: t.ink, fontSize: 16 }]}>{tr(`share.options.${o.key}`)}</Text>
              {busy === o.key ? <ActivityIndicator color={t.ink2} /> : access === o.key ? <Icon d={ICONS.tick} size={18} color={t.actionInk} width={2} /> : null}
            </Pressable>
          ))}
        </View>

        {access === "people" && (
          <View style={[styles.card, { backgroundColor: t.surface }]}>
            <View style={[styles.addRow, { borderBottomColor: t.tint, borderBottomWidth: people.data?.length ? StyleSheet.hairlineWidth * 2 : 0 }]}>
              <TextInput value={email} onChangeText={setEmail} placeholder={tr("share.addByEmail")} placeholderTextColor={t.ink2} keyboardType="email-address"
                autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => void add()}
                accessibilityLabel={tr("share.addByEmail")} selectionColor={t.accent} style={[font.regular, { flex: 1, color: t.ink, fontSize: 16, minHeight: 44 }]} />
              <Pressable accessibilityRole="button" disabled={busy === "add" || !email.trim()} onPress={() => void add()} style={styles.addButton}>
                {busy === "add" ? <ActivityIndicator color={t.ink2} /> : <Text style={[font.semibold, { color: email.trim() ? t.actionInk : t.ink2, fontSize: 16 }]}>{tr("common.add")}</Text>}
              </Pressable>
            </View>
            {(people.data ?? []).map((p, i, all) => (
              <View key={p.id} style={[styles.person, { borderBottomColor: t.tint, borderBottomWidth: i < all.length - 1 ? StyleSheet.hairlineWidth * 2 : 0 }]}>
                <Text numberOfLines={1} style={[font.regular, { flex: 1, color: t.ink, fontSize: 15 }]}>{p.email}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={tr("share.stopA11y", { email: p.email })} onPress={() => remove(p)} style={styles.removeButton}>
                  <Icon d={ICONS.close} size={14} color={t.ink2} width={1.6} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {access === "anyone" && publicUrl && (
          // The public address itself, marked as public, so what "anyone" means is plain.
          <View style={[styles.card, styles.publicCard, { backgroundColor: t.surface }]}>
            <View style={styles.publicHead}>
              <Icon d={ICONS.globe} size={16} color={t.actionInk} width={1.6} />
              <Text style={[font.semibold, { color: t.actionInk, fontSize: 13 }]}>{tr("share.publicLink")}</Text>
            </View>
            <View style={styles.publicRow}>
              <Text selectable numberOfLines={2} style={[styles.url, { color: t.ink }]}>{publicUrl.replace(/^https?:\/\//, "")}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={tr("share.copyPublic")} onPress={async () => { await Clipboard.setStringAsync(publicUrl); toast(tr("share.linkCopied")); }}
                style={[styles.copy, { backgroundColor: t.tint }]}>
                <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: t.ink, fontSize: 14 }]}>{tr("common.copy")}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={[font.regular, styles.footnote, { color: t.ink2 }]}>{tr(`share.sees.${access}`)}</Text>
      </ScrollView>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: off }}
          disabled={off}
          onPress={() => void shareLink()}
          style={({ pressed }) => [styles.shareButton, { backgroundColor: off ? t.railActive : t.brand, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon d={ICONS.share} size={18} color={off ? t.ink2 : t.onBrand} width={1.6} />
          <Text maxFontSizeMultiplier={scale.title} style={[font.semibold, { color: off ? t.ink2 : t.onBrand, fontSize: 16 }]}>{tr("share.shareLink")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  page: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  what: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  section: { paddingHorizontal: 4, paddingTop: 12, fontSize: 14 },
  card: { borderRadius: 14, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, paddingHorizontal: 16 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 6 },
  addButton: { minHeight: 44, minWidth: 56, alignItems: "center", justifyContent: "center" },
  person: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 6 },
  removeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  publicCard: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  publicHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  publicRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  url: { flex: 1, fontFamily: "Menlo", fontSize: 13, lineHeight: 18 },
  copy: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" },
  footnote: { paddingHorizontal: 4, fontSize: 13, lineHeight: 18 },
  bottom: { paddingHorizontal: 16, paddingTop: 8 },
  shareButton: { minHeight: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
