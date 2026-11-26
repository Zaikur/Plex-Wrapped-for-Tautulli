// Signed-cookie Plex sessions and login rate limiting

import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import { dataPath } from "./storage";
import { getConfig } from "./config";
import type { SessionInfo, ViewerInfo } from "@/types/api";

const SECRET_FILE = dataPath("session-secret");
const VIEWER_COOKIE = "pwft_session";
const PIN_COOKIE = "pwft_pin";

export const VIEWER_TTL = 7 * 24 * 3600;
const PIN_TTL = 15 * 60;

let secret: Buffer | null = null;

export const loadSessionSecret = async () => {
  try {
    const hex = (await fs.readFile(SECRET_FILE, "utf8")).trim();
    if (/^[0-9a-f]{64}$/.test(hex)) {
      secret = Buffer.from(hex, "hex");
      return;
    }
  } catch {
    // generated below
  }
  await rotateSessionSecret();
};

/** Invalidates every existing session (viewer and admin) */
export const rotateSessionSecret = async () => {
  const next = crypto.randomBytes(32);
  await fs.writeFile(SECRET_FILE, next.toString("hex"));
  secret = next;
};

const b64url = (buf: Buffer) => buf.toString("base64url");

const sign = (payload: object): string => {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = b64url(crypto.createHmac("sha256", secret!).update(body).digest());
  return `${body}.${mac}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const verify = (token: string | undefined): any | null => {
  if (!token || !secret) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
};

const parseCookies = (req: Request): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
};

const setCookie = (req: Request, res: Response, name: string, payload: object, ttl: number) => {
  res.cookie(name, sign({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl }), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: ttl * 1000,
    path: "/",
  });
};

const clearCookie = (res: Response, name: string) => res.clearCookie(name, { path: "/" });

// ============ Viewer sessions ============

export const setViewerSession = (req: Request, res: Response, viewer: ViewerInfo) => setCookie(req, res, VIEWER_COOKIE, viewer, VIEWER_TTL);

export const clearViewerSession = (res: Response) => clearCookie(res, VIEWER_COOKIE);

/** The viewer session, only if it is valid for the current access mode */
export const getViewer = (req: Request): ViewerInfo | null => {
  const payload = verify(parseCookies(req)[VIEWER_COOKIE]);
  if (!payload || typeof payload.userId !== "number") return null;
  if (payload.kind !== "plex" || typeof payload.plexUsername !== "string") return null;
  return { kind: "plex", userId: payload.userId, name: payload.name, thumb: payload.thumb, plexUsername: payload.plexUsername, plexUserId: payload.plexUserId };
};

// ============ Admin sessions ============

export const isAdmin = (req: Request): boolean => {
  const viewer = getViewer(req);
  const admin = getConfig().plexAuth;
  if (!viewer || !admin.adminPlexUsername) return false;
  return admin.adminPlexUserId
    ? viewer.plexUserId === admin.adminPlexUserId
    : viewer.plexUsername?.toLowerCase() === admin.adminPlexUsername.toLowerCase();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isAdmin(req)) {
    res.status(401).json({ error: "Admin login required" });
    return;
  }
  next();
};

// ============ Plex PIN binding ============
// The PIN id is tied to the browser that created it, so nobody else can poll it.

export const setPinCookie = (req: Request, res: Response, pinId: number) => setCookie(req, res, PIN_COOKIE, { pinId }, PIN_TTL);

export const getPinFromCookie = (req: Request): number | null => {
  const payload = verify(parseCookies(req)[PIN_COOKIE]);
  return typeof payload?.pinId === "number" ? payload.pinId : null;
};

export const clearPinCookie = (res: Response) => clearCookie(res, PIN_COOKIE);

// ============ Access ============

export const getSessionInfo = (req: Request): SessionInfo => {
  const viewer = getViewer(req);
  const admin = isAdmin(req);
  return { viewer, isAdmin: admin, canViewAnyone: admin };
};

// ============ Rate limiting ============

const attempts = new Map<string, { count: number; reset: number }>();

/** Returns false once a client exceeds 10 attempts per minute for the given bucket */
export const allowAttempt = (req: Request, bucket: string): boolean => {
  const key = `${bucket}:${req.ip}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + 60_000 });
    if (attempts.size > 10_000) {
      for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    }
    return true;
  }
  entry.count++;
  return entry.count <= 10;
};
