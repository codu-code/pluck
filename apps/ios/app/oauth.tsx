import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Wordmark } from "@/components/Wordmark";
import { finishSignIn } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";

// io.getpluck.app:/oauth?code=…&state=… lands here when the email link finished sign-in in Safari.
export default function OAuthReturn() {
  const t = useTheme();
  const { code, state } = useLocalSearchParams<{ code?: string; state?: string }>();
  useEffect(() => {
    void finishSignIn(`io.getpluck.app:/oauth?${new URLSearchParams({ code: code ?? "", state: state ?? "" })}`).then((ok) =>
      router.replace(ok ? "/welcome" : "/signin?stale=1"),
    );
  }, [code, state]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20, backgroundColor: t.ground }}>
      <Wordmark size={41} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLiveRegion="polite">
        <ActivityIndicator color={t.ink2} />
        <Text style={[font.regular, { color: t.ink2, fontSize: 15 }]}>Signing you in.</Text>
      </View>
    </View>
  );
}
