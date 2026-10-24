// The public interface of packages/db. Raw client and Db handles stay internal so every caller goes through userId-scoped functions.
export { ping } from "./client.ts";
export { authAdapter } from "./auth.ts";
export {
  pluckLink, createFileItem, createTextItem, editItem, applyExtraction, recordExtractionFailure, resetExtraction, setBlobKeys,
  findByUrl, getItem, getItemBlobKeys, getContent, listItems, urlHash, batchUpdate, markOpened, moveToBin, restoreFromBin, purgeBin,
  countItems, BIN_DAYS,
  type PluckLinkInput, type TextItemInput, type ItemEdit, type BatchEdit, type ExtractionResult,
} from "./items.ts";
export { createHighlight, listHighlights, updateHighlight, deleteHighlight, type HighlightInput } from "./highlights.ts";
export { enqueue, claimJob, completeJob, retryJob, failJob, pendingJobCount, type Job } from "./jobs.ts";
export { hitRateLimit } from "./rate-limit.ts";
export {
  slugify, listTags, createTag, renameTag, deleteTag, resolveTags, nearestTags, setItemTags, recountTags, batchTags, purgeAiTags, countAiTagged,
} from "./tags.ts";
export { searchItems, snippetFor } from "./search.ts";
export {
  createList, listLists, getListMeta, getList, updateList, deleteList, addToList, removeFromList, updateEntry, reorderList, listsForItem,
  setVisibility, listOwnedBy, type NewList, type ListEdit, type EntryEdit, type VisibilityResult,
} from "./lists.ts";
export { getMe, markMcpCall, setName, setHandle, updateSettings, type HandleResult } from "./users.ts";
export { expireItems, archiveStale, countExpiringSoon, runDueExpiry, claimOnce, localNow } from "./expiry.ts";
export { DEFAULT_SETTINGS, type UserSettings } from "./collections.ts";
export { publicList, publicListById, publicCoverKey, recordView, createReport, PUBLIC_ITEM_FIELDS } from "./public.ts";
export { openReports, resolveReport, killList, killUser, isAdminEmail } from "./admin.ts";
export { digestFor, isEmptyDigest, claimDueDigests } from "./digest.ts";
export { aliasOf, regenerateAlias, userForAlias, createEmailItem, setRawEmailKey, type EmailItemInput } from "./email-in.ts";
export { createApiKey, listApiKeys, revokeApiKey, verifyApiKey, DEFAULT_KEY_SCOPES } from "./api-keys.ts";
export {
  createImport, getImport, claimImportStart, updateImport, importLink, startExport, finishExport, latestExport, exportData, deleteAccountData,
} from "./account.ts";
export { aiConnections, disconnectAi, isAiConnected } from "./ai-tools.ts";
export { holdTry, takeTry } from "./tries.ts";
