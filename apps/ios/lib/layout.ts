// The iPad layout from docs/handover/ipad (iPad-Spec): from 600 wide the split view, under it (an iPhone, or an iPad
// window in Split View or Stage Manager) the iPhone layout and tab bar. useColumns (components/split) reads the
// window, so it changes as a Stage Manager window is resized. Pure, so `pnpm test` can check the breakpoints.
export const WIDE = 600;

export type Columns = { wide: boolean; pinned: boolean; list: number };

// pinned: the sidebar sits beside the list (any iPad in landscape); otherwise it hides behind its button and comes
// over the list. list: the middle column, 380 in landscape, 360 in 13 in portrait (1032), 320 on mini (744).
export function columnsFor(width: number): Columns {
  return {
    wide: width >= WIDE,
    pinned: width >= 1100,
    list: width >= 1100 ? 380 : width >= 900 ? 360 : 320,
  };
}
