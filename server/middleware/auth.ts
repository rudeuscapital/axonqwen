/**
 * server/middleware/auth.ts
 * ──────────────────────────────────────────────────────────────
 * JWT authentication middleware for Express routes.
 * ──────────────────────────────────────────────────────────────
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth.js';

export interface AuthUser {
  address: string;
  chain: string;
  shortAddress: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware that verifies JWT from Authorization header.
 * Rejects with 401 if no valid token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please connect your wallet.' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please reconnect your wallet.' });
  }
}
