import { useColorScheme } from "react-native";

// The tokens from packages/ui/src/tokens.css, light and dark, for native views.
export const palettes = {
  light: {
    ground: "#F6F8F4", rail: "#EDF0EA", railActive: "#DFE4DA", tint: "#E6EBE2", selected: "#E6EBE2", surface: "#FFFFFF", field: "#EBEEE7",
    chip: "#E3E8DE", avatar: "#D6DCD0", line: "#DDE2D8", lineStrong: "#CDD3C7", lineDashed: "#C3CABC", ink: "#151A13", ink2: "#525A4E",
    brand: "#1E5C45", onBrand: "#F6F8F4", accent: "#34A07C", highlight: "#7FD3AE", highlightWash: "#C9EEDC", clay: "#9A5536",
    syncBg: "#F1E6D9", syncInk: "#7A4520", syncDot: "#C27A3A", danger: "#A3341F",
    tiles: ["#E1E6CF", "#E6DCD6", "#DCE1E3", "#E2E6DA", "#DFE2DC", "#DDE3D9"],
  },
  dark: {
    ground: "#10130F", rail: "#161A14", railActive: "#252A22", tint: "#191D17", selected: "#1E221C", surface: "#191D17", field: "#191D17",
    chip: "#252A22", avatar: "#252A22", line: "#2A2F27", lineStrong: "#363C33", lineDashed: "#3A4036", ink: "#ECEFE8", ink2: "#A0A898",
    brand: "#1E5C45", onBrand: "#F6F8F4", accent: "#34A07C", highlight: "#7FD3AE", highlightWash: "#24493A", clay: "#D08A68",
    syncBg: "#3A2A1C", syncInk: "#E8B88E", syncDot: "#C27A3A", danger: "#E07A62",
    tiles: ["#263020", "#33302A", "#26292B", "#292E25", "#2A2A26", "#20251E"],
  },
};
export type Palette = typeof palettes.light;

export function useTheme(): Palette {
  return palettes[useColorScheme() === "dark" ? "dark" : "light"];
}

// Geist is bundled (expo-font); weights pick the face.
export const font = {
  regular: { fontFamily: "Geist", fontWeight: "400" as const },
  medium: { fontFamily: "Geist", fontWeight: "500" as const },
  semibold: { fontFamily: "Geist", fontWeight: "600" as const },
  bold: { fontFamily: "Geist", fontWeight: "700" as const },
  reader: { fontFamily: "Source Serif 4", fontWeight: "400" as const },
  readerTitle: { fontFamily: "Source Serif 4", fontWeight: "600" as const },
};
