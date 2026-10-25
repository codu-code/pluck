import { PLAYERS, playerSrc, type Facts } from "@pluck/shared-schemas";
import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { WebView } from "react-native-webview";
import { useTranslations } from "use-intl";
import { useOnline } from "@/lib/data";
import { font, useTheme } from "@/lib/theme";

const PLAY = "M5 3.5v9l7.5-4.5z";
const ORIGIN = "https://getpluck.io/"; // the page the player sits in, so it is sent as the Referer (YouTube requires one)

// A video or episode that plays in the Item. Nothing loads from the provider until Play is tapped; the player is
// built from an allowed id, and anything in it that tries to leave (a channel link, a logo) opens outside the app.
export function Player({ facts, title, site, cover }: { facts: Facts; title: string; site: string; cover: { uri: string; headers: Record<string, string> } | null }) {
  const t = useTheme();
  const tr = useTranslations("ios.preview");
  const online = useOnline();
  const [on, setOn] = useState(false);
  const src = playerSrc(facts);
  if (!src || !facts.player) return null;
  const ratio = facts.vertical ? 9 / 16 : PLAYERS[facts.player.provider].ratio;
  const bar = ratio === 0;
  const frame = [styles.frame, bar ? { height: 152, borderRadius: 12, backgroundColor: t.rail } : { aspectRatio: ratio, backgroundColor: t.ink }, facts.vertical && styles.vertical];
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:transparent}iframe{border:0;width:100%;height:100%}</style><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  return (
    <View style={{ gap: 8 }}>
      {on ? (
        <View style={frame}>
          <WebView
            source={{ html, baseUrl: ORIGIN }}
            originWhitelist={["*"]}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            style={{ backgroundColor: "transparent" }}
            onShouldStartLoadWithRequest={(r) => {
              if (!r.isTopFrame || r.url === "about:blank" || r.url.startsWith(ORIGIN)) return true;
              void Linking.openURL(r.url);
              return false;
            }}
          />
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={tr("playA11y", { title })} accessibilityState={{ disabled: !online }} disabled={!online} onPress={() => setOn(true)} style={frame}>
          {cover && !bar && <Image source={cover} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />}
          <View style={[styles.inner, bar && { justifyContent: "flex-start", paddingHorizontal: 20 }]}>
            <View style={[styles.play, { backgroundColor: online ? t.brand : t.ink2 }]}><Svg width={22} height={22} viewBox="0 0 16 16"><Path d={PLAY} fill={t.onBrand} /></Svg></View>
            {bar && <Text numberOfLines={2} style={[font.semibold, { flex: 1, color: t.ink, fontSize: 16 }]}>{title}</Text>}
          </View>
        </Pressable>
      )}
      {!on && <Text style={[font.regular, { color: t.ink2, fontSize: 13 }]}>{online ? tr("playNote", { site }) : tr("offline")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", borderRadius: 8, overflow: "hidden" },
  vertical: { maxWidth: 320, alignSelf: "center" },
  inner: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  play: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", paddingLeft: 3 },
});
