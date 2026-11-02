import { z } from "zod";

export const Kind = z.enum(["link", "video", "pdf", "image", "note", "todo", "thing"]);
export type Kind = z.infer<typeof Kind>;
export const LINK_KINDS = ["link", "video", "pdf", "image"] as const satisfies readonly Kind[];

export const Status = z.enum(["inbox", "later", "archived", "done"]);
export type Status = z.infer<typeof Status>;

export const Source = z.enum(["ios", "extension", "web", "email", "mcp", "import", "api", "copied"]);
export type Source = z.infer<typeof Source>;

export const Visibility = z.enum(["private", "public"]);
export const ExtractionState = z.enum(["pending", "done", "failed", "none"]);
export const ArchivedReason = z.enum(["user", "expired", "bulk", "import"]);

// Why someone removed the browser extension: the one question on its goodbye page, counted with no one named.
export const ExtensionRemovedReason = z.enum(["unused", "in-the-way", "missing", "other"]);
export type ExtensionRemovedReason = z.infer<typeof ExtensionRemovedReason>;

// "How did you find Pluck?", asked once after the first Pluck. "skipped" is "Rather not say".
export const HeardFrom = z.enum(["search", "friend", "social", "public-list", "ai-tool", "newsletter", "other", "skipped"]);
export type HeardFrom = z.infer<typeof HeardFrom>;
