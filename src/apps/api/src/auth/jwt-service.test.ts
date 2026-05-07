import { describe, expect, it } from "vitest";
import { JwtService } from "./jwt-service.js";

describe("JwtService", () => {
  const jwtService = new JwtService({
    accessTokenSecret: "test-access-secret-12345678",
    refreshTokenSecret: "test-refresh-secret-87654321",
    accessTokenExpiresIn: "15m",
    refreshTokenExpiresIn: "7d"
  });

  describe("generateAccessToken", () => {
    it("generates a valid JWT access token", () => {
      const token = jwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
    });

    it("includes user data in token payload", () => {
      const token = jwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      const payload = jwtService.verifyAccessToken(token);

      expect(payload).toMatchObject({
        userId: "user_123",
        email: "test@example.com"
      });
    });

    it("generates different tokens for different users", () => {
      const token1 = jwtService.generateAccessToken({
        id: "user_123",
        email: "test1@example.com",
        createdAt: new Date().toISOString()
      });

      const token2 = jwtService.generateAccessToken({
        id: "user_456",
        email: "test2@example.com",
        createdAt: new Date().toISOString()
      });

      expect(token1).not.toBe(token2);
    });
  });

  describe("generateRefreshToken", () => {
    it("generates a valid refresh token", () => {
      const token = jwtService.generateRefreshToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token.length).toBe(64);
    });

    it("generates different tokens on each call", () => {
      const token1 = jwtService.generateRefreshToken();
      const token2 = jwtService.generateRefreshToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("hashRefreshToken", () => {
    it("hashes refresh token consistently", () => {
      const token = "test-refresh-token";
      const hash1 = jwtService.hashRefreshToken(token);
      const hash2 = jwtService.hashRefreshToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates different hashes for different tokens", () => {
      const hash1 = jwtService.hashRefreshToken("token1");
      const hash2 = jwtService.hashRefreshToken("token2");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyAccessToken", () => {
    it("verifies valid access token", () => {
      const token = jwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      const payload = jwtService.verifyAccessToken(token);

      expect(payload).toMatchObject({
        userId: "user_123",
        email: "test@example.com"
      });
    });

    it("rejects token signed with wrong secret", () => {
      const wrongJwtService = new JwtService({
        accessTokenSecret: "wrong-secret",
        refreshTokenSecret: "test-refresh-secret-87654321",
        accessTokenExpiresIn: "15m",
        refreshTokenExpiresIn: "7d"
      });

      const token = wrongJwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      expect(() => jwtService.verifyAccessToken(token)).toThrow();
    });

    it("rejects malformed token", () => {
      expect(() => jwtService.verifyAccessToken("invalid-token")).toThrow();
    });

    it("rejects empty token", () => {
      expect(() => jwtService.verifyAccessToken("")).toThrow();
    });
  });

  describe("token expiration", () => {
    it("rejects expired access token", async () => {
      const shortLivedJwtService = new JwtService({
        accessTokenSecret: "test-access-secret-12345678",
        refreshTokenSecret: "test-refresh-secret-87654321",
        accessTokenExpiresIn: "1ms",
        refreshTokenExpiresIn: "7d"
      });

      const token = shortLivedJwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(() => shortLivedJwtService.verifyAccessToken(token)).toThrow();
    });

    it("accepts non-expired access token", () => {
      const token = jwtService.generateAccessToken({
        id: "user_123",
        email: "test@example.com",
        createdAt: new Date().toISOString()
      });

      expect(() => jwtService.verifyAccessToken(token)).not.toThrow();
    });
  });

  describe("parseExpiresIn", () => {
    it("calculates correct expiration times", () => {
      expect(jwtService.getAccessTokenExpiresInSeconds()).toBe(15 * 60);
      expect(jwtService.getRefreshTokenExpiresInSeconds()).toBe(7 * 24 * 60 * 60);
    });
  });
});
