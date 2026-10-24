import { isAdminEmail, killList, killUser, openReports, resolveReport } from "@pluck/db";
import type { AdminReport } from "@pluck/shared-schemas";
import { ApiError } from "../errors";

// Admin actions, for emails on the ADMIN_EMAILS allowlist only.
export async function assertAdmin(email: string): Promise<void> {
  if (!(await isAdminEmail(email))) throw new ApiError("forbidden", "Not for this account.", 403);
}

export const reportsToReview = (): Promise<AdminReport[]> => openReports();
export const closeReport = (id: string) => resolveReport(id);
export const takeDownList = (listId: string) => killList(listId);
export const closeAccountPages = (userId: string) => killUser(userId);
