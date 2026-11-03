import { createContext, useContext } from "react";
import { useWindowDimensions } from "react-native";
import { columnsFor, type Columns } from "@/lib/layout";

// The iPad split view's state, apart from Split.tsx so the screens it shows can read it without a require cycle.

export function useColumns(): Columns {
  return columnsFor(useWindowDimensions().width);
}

// What the detail column shows: an Item, a List, a group of Settings, or nothing yet.
export type Detail = { kind: "item" | "list" | "settings"; id: string } | null;
// What the list column shows: the tab you are on, or one of the sidebar's places that is not a tab.
export type Section = "tabs" | "archive" | "bin" | "settings";
type Split = {
  detail: Detail;
  show: (d: Detail) => void;
  section: Section;
  go: (s: Section) => void;
  pinned: boolean; // the sidebar sits beside the list
  sidebar: boolean; // showing: beside the list where pinned (hidden with its button), over it where not
  setSidebar: (open: boolean) => void;
};
export const SplitContext = createContext<Split | null>(null);

// null in the iPhone layout, so a caller pushes the route as it always has.
export const useSplit = () => useContext(SplitContext);


// True inside the detail column: the Item and the List draw their iPad bars instead of the iPhone's back button
// and bottom toolbar.
export const InDetail = createContext(false);
export const useInDetail = () => useContext(InDetail);
