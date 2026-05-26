// Guards the /api/ops console. With an ADMIN_TOKEN set, a matching header is
// required. With no token set, access is allowed ONLY from localhost (dev), so a
// deployed instance is never wide open even in dry_run.
import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

function isLocalhost(req: Request): boolean {
  const ip = req.ip || req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip.endsWith("127.0.0.1");
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (config.adminToken) {
    if (req.headers["x-admin-token"] !== config.adminToken) {
      res.status(401).json({ error: "Admin authorization required." });
      return;
    }
    return next();
  }
  // No token configured: only the local machine may use the console.
  if (isLocalhost(req)) return next();
  res.status(503).json({ error: "Set ADMIN_TOKEN to use the ops console from a non-local host." });
}
