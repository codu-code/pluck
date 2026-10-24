// Row formatting lives in shared-schemas (the iOS app uses it too); the web-only URLs are here.
export { ago, dueLabel, initials, rowMeta, rowSite, sourceLabel, tileIndex, when } from "@pluck/shared-schemas";

export const coverSrc = (id: string) => `/api/v1/items/${id}/cover`;
export const waybackUrl = (url: string) => `https://web.archive.org/web/*/${url}`;
