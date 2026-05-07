import type { Request, Response, NextFunction } from "express";

export type UserRole = "user" | "admin" | "viewer";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      return res.status(403).json({ 
        error: "Insufficient permissions",
        required: allowedRoles,
        current: authReq.user.role
      });
    }

    next();
  };
}

export function requireAdmin() {
  return requireRole(["admin"]);
}

export function requireUser() {
  return requireRole(["user", "admin"]);
}
