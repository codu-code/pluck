import tokens from "@pluck/ui/tokens.json";
import Svg, { Path } from "react-native-svg";
import { useTranslations } from "use-intl";

type Kind = "link" | "video" | "pdf" | "image" | "note" | "todo" | "thing";
const KEY = { link: "read", video: "watch", pdf: "pdf", image: "image", note: "note", todo: "todo", thing: "thing" } as const;
export const KINDS = Object.keys(KEY) as Kind[];

// The seven kind glyphs from packages/ui, and the few UI icons the boards draw, on a 16-unit grid.
export function KindGlyph({ kind, size = 16, color }: { kind: Kind; size?: number; color: string }) {
  const t = useTranslations("ios.kinds");
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityLabel={t(kind)}>
      <Path d={tokens.kindGlyphs16[KEY[kind]]} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const ICONS = {
  inbox: "M2 9h3l1 2h4l1-2h3M3.5 3h9L14 9v4H2V9z",
  later: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM8 5v3l2 1.5",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6L14 14",
  lists: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01",
  listsTab: "M4 2.5h8M3 5h10M2.5 7.5h11v6h-11z", // the Lists tab on the IOSInbox board: a stack, not the bullets
  chevron: "M6 3l5 5-5 5",
  back: "M10 3L5 8l5 5",
  archive: "M2 3h12v3H2zM3 6v7h10V6M6.5 9h3",
  tag: "M2 2.5h5.5L14 9l-5 5-6.5-6.5zM5 5.5h.01",
  share: "M8 10V2M5 4.5L8 1.5l3 3M4 7H3v7h10V7h-1",
  original: "M9 2h5v5M14 2L7.5 8.5M12 9.5V14H2V4h4.5",
  tick: "M3.5 8.5l3 3 6-7",
  plus: "M8 3v10M3 8h10",
  more: "M3.5 7.1a.9.9 0 1 1 0 1.8a.9.9 0 1 1 0-1.8zM8 7.1a.9.9 0 1 1 0 1.8a.9.9 0 1 1 0-1.8zM12.5 7.1a.9.9 0 1 1 0 1.8a.9.9 0 1 1 0-1.8z",
  lock: "M4.5 7.5V5a3.5 3.5 0 0 1 7 0v2.5M3.5 7.5h9v6h-9z",
  people: "M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M11 7.2a2 2 0 1 0-.8-3.9M12.2 9.6c1.4.4 2.3 1.6 2.3 3.4",
  close: "M4 4l8 8M12 4l-8 8",
  globe: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM2 8h12M8 2c1.8 1.7 2.6 3.8 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.2 5.4 8S6.2 3.7 8 2z",
  compose: "M3 13l.8-3L10.5 3.3l2.2 2.2L6 12.2zM9.3 4.5l2.2 2.2",
  offline: "M4.5 12.5h7a2.75 2.75 0 0 0 .55-5.45A4 4 0 0 0 4.3 6.3a3.1 3.1 0 0 0 .2 6.2zM2.5 2.5l11 11", // a cloud, struck through (the web nav draws the same)
};

export function Icon({ d, size = 22, color, width = 1.4 }: { d: string; size?: number; color: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
