import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@trade/shared";
import { JwtService } from "./jwt-service.js";

export interface AuthMiddlewareConfig {
  jwtService: JwtService;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Missing authorization header",
            correlationId: request.id
          }
        });
      }

      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return reply.status(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Invalid authorization header format. Expected: Bearer <token>",
            correlationId: request.id
          }
        });
      }

      const token = parts[1];
      const payload = config.jwtService.verifyAccessToken(token);

      // Attach user to request
      request.user = payload;
    } catch (error) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: error instanceof Error ? error.message : "Invalid or expired token",
          correlationId: request.id
        }
      });
    }
  };
}

export function createOptionalAuthMiddleware(config: AuthMiddlewareConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        return; // No auth header, continue without user
      }

      const parts = authHeader.split(" ");
      if (parts.length !== 2 || parts[0] !== "Bearer") {
        return; // Invalid format, continue without user
      }

      const token = parts[1];
      const payload = config.jwtService.verifyAccessToken(token);

      // Attach user to request
      request.user = payload;
    } catch (error) {
      // Token verification failed, continue without user
      return;
    }
  };
}
