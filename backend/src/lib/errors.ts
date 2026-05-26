// Centralized error handling so a thrown error never crashes the process or leaks
// a stack trace to clients. Pair with `express-async-errors` (imported in index.ts)
// so async route handlers route thrown errors here automatically.
import type { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}
export function notFoundError(message = "Not found"): HttpError {
  return new HttpError(404, message);
}

// 404 for unmatched routes.
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Final error handler (must have 4 args for Express to treat it as such).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  if (status >= 500) console.error("[error]", err);
  if (res.headersSent) return;
  res.status(status).json({ error: status >= 500 ? "Internal server error" : message });
}

// Catch anything that slips past Express so the process stays alive.
export function installProcessGuards(): void {
  process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
}
