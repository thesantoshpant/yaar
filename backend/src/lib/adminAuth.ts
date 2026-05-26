// Guards the /api/ops console. In dry_run with no token set, it stays open for
// local dev. The moment you leave dry_run, an ADMIN_TOKEN is required.
import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!config.adminToken) {
    if (config.autonomyMode === "dry_run") return next();
    res.status(503).json({ error: "Set ADMIN_TOKEN to use the ops console outside dry_run mode." });
    return;
  }
  const token = req.headers["x-admin-token"];
  if (token !== config.adminToken) {
    res.status(401).json({ error: "Admin authorization required." });
    return;
  }
  next();
}
