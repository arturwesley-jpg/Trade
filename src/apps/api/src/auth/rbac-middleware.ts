import type { FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@trade/shared";

/**
 * Role-Based Access Control middleware factory
 * Creates middleware that checks if the authenticated user has one of the required roles
 *
 * @param allowedRoles - Array of roles that are allowed to access the route
 * @returns Fastify middleware function
 *
 * @example
 * app.get('/admin/users', { preHandler: requireRole(['admin']) }, handler)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated
    if (!request.user) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
          correlationId: request.id
        }
      });
    }

    // Check if user has required role
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
          correlationId: request.id
        }
      });
    }
  };
}

/**
 * Middleware that allows access to authenticated users or specific roles for anonymous users
 * Useful for routes that have different behavior based on authentication status
 *
 * @param allowedRoles - Array of roles allowed for authenticated users
 * @returns Fastify middleware function
 */
export function optionalRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // If user is authenticated, check role
    if (request.user && !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
          correlationId: request.id
        }
      });
    }
  };
}
