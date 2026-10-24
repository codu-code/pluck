import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { finishSignIn } from "@/lib/session";
import { useTheme } from "@/lib/theme";

// io.getpluck.app:/oauth?code=…&state=… lands here when the email link finished sign-in in Safari.
export default function OAuthReturn() {
  const t = useTheme();
  const { code, state } = useLocalSearchParams<{ code?: string; state?: string }>();
  useEffect(() => {
    void finishSignIn(`io.getpluck.app:/oauth?${new URLSearchParams({ code: code ?? "", state: state ?? "" })}`).then((ok) =>
      router.replace(ok ? "/welcome" : "/signin"),
    );
  }, [code, state]);
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.ground }}><ActivityIndicator /></View>;
}
