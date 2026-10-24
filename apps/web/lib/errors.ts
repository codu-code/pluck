import type { ErrorCode } from "@pluck/shared-schemas";

// Thrown anywhere in the library; the REST wrapper and the MCP layer turn it into their own error shape.
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}
