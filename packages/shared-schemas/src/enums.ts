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
