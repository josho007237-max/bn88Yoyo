// src/middleware/authGuard.ts
import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../lib/jwt";

export type AuthPayload = {
  sub: string;
  email: string;
  roles: string[];
  tokenType?: string;
};

function readBearerToken(req: Request): string {
  // Express normalizes header keys to lowercase
  const raw = String(req.headers.authorization || req.get("authorization") || "");
  if (!raw) return "";

  // รองรับ Bearer / bearer
  const lower = raw.toLowerCase();
  if (!lower.startsWith("bearer ")) return "";

  return raw.slice(7).trim();
}

export function authGuard(req: Request, res: Response, next: NextFunction) {
  try {
    const token = readBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "missing_token" });
    }

    const payload = verifyJwt<AuthPayload>(token);

    (req as any).auth = payload;
    return next();
  } catch (err) {
    console.error("authGuard invalid token:", err);
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }
}

