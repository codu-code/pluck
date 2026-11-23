// The Note editor's web build, imported by its file so the web app bundles the editor alone (RichBody.tsx). Only what
// Pluck uses of it is typed here: the package's own types reach into React Native, which the web app does not have.
declare module "react-native-enriched-markdown/lib/module/EnrichedMarkdownTextInput.web.js" {
  import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from "react";
  type On = { isActive: boolean };
  export type StyleState = { bold: On; italic: On; heading: On & { level: 1 | 2 | 3 | 4 | 5 | 6 }; unorderedList: On & { depth: number }; orderedList: On & { depth: number } };
  export type EnrichedMarkdownTextInputInstance = {
    getMarkdown(): Promise<string>;
    toggleBold(): void;
    toggleItalic(): void;
    toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6): void;
    toggleUnorderedList(): void;
    toggleOrderedList(): void;
    focus(): void;
  };
  type Heading = { fontSize?: number; fontWeight?: string; color?: string };
  export const EnrichedMarkdownTextInput: ForwardRefExoticComponent<
    {
      defaultValue?: string;
      placeholder?: string;
      autoFocus?: boolean;
      className?: string;
      style?: CSSProperties;
      "aria-label"?: string;
      onChangeMarkdown?: (markdown: string) => void;
      onChangeState?: (state: StyleState) => void;
      markdownStyle?: Partial<Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", Heading>>;
    } & RefAttributes<EnrichedMarkdownTextInputInstance>
  >;
}
