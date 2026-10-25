import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { font, useTheme } from "@/lib/theme";

// The wordmark from packages/ui's Logo (Logo board): "pluck" in Fredoka 700, three sparks popping off the k.
export function Wordmark({ size = 40 }: { size?: number }) {
  const t = useTheme();
  const spark = size * 0.457;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Pluck" style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <Text allowFontScaling={false} style={[font.logo, { color: t.logoInk, fontSize: size, lineHeight: size * 1.05, letterSpacing: -0.01 * size }]}>pluck</Text>
      <Svg viewBox="0 0 12 12" width={spark} height={spark} style={{ marginLeft: -0.098 * size, marginTop: 0.022 * size }}>
        <Path d="M2.2 5.6L2.8 2.3M5 7.4L8 4.7M5.8 10.6L9.4 9.85" fill="none" stroke={t.logoSpark} strokeWidth={size >= 80 ? 1.8 : 2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
