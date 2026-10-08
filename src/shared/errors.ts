export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
export const notFound = (message = "Resource tidak ditemukan") => new AppError(404, "NOT_FOUND", message);
