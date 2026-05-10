import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import type { JwtPayload, User } from "@trade/shared";

export interface JwtServiceConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiresIn?: string;
  refreshTokenExpiresIn?: string;
}

export class JwtService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiresIn: string;
  private refreshTokenExpiresIn: string;

  constructor(config: JwtServiceConfig) {
    this.accessTokenSecret = config.accessTokenSecret;
    this.refreshTokenSecret = config.refreshTokenSecret;
    this.accessTokenExpiresIn = config.accessTokenExpiresIn ?? "15m";
    this.refreshTokenExpiresIn = config.refreshTokenExpiresIn ?? "7d";
  }

  generateAccessToken(user: User): string {
    const payload: Omit<JwtPayload, "iat" | "exp"> = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn
    });
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString("hex");
  }

  hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.accessTokenSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Access token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid access token");
      }
      throw error;
    }
  }

  verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.refreshTokenSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Refresh token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid refresh token");
      }
      throw error;
    }
  }

  getAccessTokenExpiresInSeconds(): number {
    return this.parseExpiresIn(this.accessTokenExpiresIn);
  }

  getRefreshTokenExpiresInSeconds(): number {
    return this.parseExpiresIn(this.refreshTokenExpiresIn);
  }

  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`);

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 60 * 60 * 24;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }
}
