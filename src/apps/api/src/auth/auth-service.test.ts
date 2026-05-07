import { describe, expect, it, beforeEach } from "vitest";
import { AuthService } from "./auth-service.js";
import { AuthRepository } from "./auth-repository.js";
import { JwtService } from "./jwt-service.js";
import { PasswordService } from "./password-service.js";
import type { User } from "@trade/shared";

describe("AuthService", () => {
  let authService: AuthService;
  let mockUsers: Map<string, User & { passwordHash: string }>;
  let mockRefreshTokens: Map<string, { userId: string; tokenHash: string; expiresAt: Date; ipAddress?: string; userAgent?: string }>;

  beforeEach(() => {
    mockUsers = new Map();
    mockRefreshTokens = new Map();

    const mockAuthRepository: AuthRepository = {
      findUserByEmail: async (email: string) => {
        const user = mockUsers.get(email.toLowerCase());
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, passwordHash: user.passwordHash };
      },
      findUserById: async (id: string) => {
        for (const user of mockUsers.values()) {
          if (user.id === id) {
            return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, passwordHash: user.passwordHash };
          }
        }
        return null;
      },
      createUser: async (data: { email: string; passwordHash: string; name?: string }) => {
        const user = {
          id: `user_${Date.now()}`,
          email: data.email.toLowerCase(),
          name: data.name,
          passwordHash: data.passwordHash,
          createdAt: new Date().toISOString()
        };
        mockUsers.set(data.email.toLowerCase(), user);
        return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt, passwordHash: user.passwordHash };
      },
      updateLastLogin: async () => {},
      createRefreshToken: async (data: { userId: string; tokenHash: string; expiresAt: Date; ipAddress?: string; userAgent?: string }) => {
        mockRefreshTokens.set(data.tokenHash, data);
      },
      findRefreshToken: async (tokenHash: string) => {
        const token = mockRefreshTokens.get(tokenHash);
        if (!token) return null;
        return { userId: token.userId, tokenHash: token.tokenHash, expiresAt: token.expiresAt.toISOString(), ipAddress: token.ipAddress, userAgent: token.userAgent };
      },
      revokeRefreshToken: async (tokenHash: string) => {
        mockRefreshTokens.delete(tokenHash);
      },
      revokeAllUserRefreshTokens: async (userId: string) => {
        for (const [hash, token] of mockRefreshTokens.entries()) {
          if (token.userId === userId) {
            mockRefreshTokens.delete(hash);
          }
        }
      }
    } as AuthRepository;

    const jwtService = new JwtService({
      accessTokenSecret: "test-access-secret",
      refreshTokenSecret: "test-refresh-secret",
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresIn: "7d"
    });

    const passwordService = new PasswordService();

    authService = new AuthService({
      authRepository: mockAuthRepository,
      jwtService,
      passwordService
    });
  });

  describe("register", () => {
    it("creates a new user with valid credentials", async () => {
      const user = await authService.register({
        email: "test@example.com",
        password: "SecurePass123!",
        name: "Test User"
      });

      expect(user).toMatchObject({
        id: expect.any(String),
        email: "test@example.com",
        name: "Test User",
        createdAt: expect.any(String)
      });
    });

    it("rejects invalid email format", async () => {
      await expect(
        authService.register({
          email: "invalid-email",
          password: "SecurePass123!"
        })
      ).rejects.toThrow("Invalid email format");
    });

    it("rejects weak passwords", async () => {
      await expect(
        authService.register({
          email: "test@example.com",
          password: "weak"
        })
      ).rejects.toThrow("Password validation failed");
    });

    it("rejects duplicate email registration", async () => {
      await authService.register({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      await expect(
        authService.register({
          email: "test@example.com",
          password: "AnotherPass123!"
        })
      ).rejects.toThrow("User with this email already exists");
    });

    it("normalizes email to lowercase", async () => {
      const user = await authService.register({
        email: "Test@Example.COM",
        password: "SecurePass123!"
      });

      expect(user.email).toBe("test@example.com");
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await authService.register({
        email: "test@example.com",
        password: "SecurePass123!",
        name: "Test User"
      });
    });

    it("returns tokens and user data for valid credentials", async () => {
      const result = await authService.login({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      expect(result).toMatchObject({
        user: {
          id: expect.any(String),
          email: "test@example.com",
          name: "Test User"
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it("rejects invalid password", async () => {
      await expect(
        authService.login({
          email: "test@example.com",
          password: "WrongPassword123!"
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects non-existent user", async () => {
      await expect(
        authService.login({
          email: "nonexistent@example.com",
          password: "SecurePass123!"
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("accepts case-insensitive email", async () => {
      const result = await authService.login({
        email: "TEST@EXAMPLE.COM",
        password: "SecurePass123!"
      });

      expect(result.user.email).toBe("test@example.com");
    });
  });

  describe("verifyAccessToken", () => {
    it("returns user data for valid access token", async () => {
      const registerResult = await authService.register({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      const { accessToken } = await authService.login({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      const user = await authService.verifyAccessToken(accessToken);

      expect(user).toMatchObject({
        id: registerResult.id,
        email: "test@example.com"
      });
    });

    it("rejects invalid access token", async () => {
      await expect(
        authService.verifyAccessToken("invalid-token")
      ).rejects.toThrow();
    });
  });

  describe("refreshAccessToken", () => {
    it("returns new tokens for valid refresh token", async () => {
      await authService.register({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      const { refreshToken } = await authService.login({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String)
      });
    });

    it("rejects invalid refresh token", async () => {
      await expect(
        authService.refreshAccessToken("invalid-refresh-token")
      ).rejects.toThrow();
    });
  });

  describe("logout", () => {
    it("revokes refresh token successfully", async () => {
      await authService.register({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      const { refreshToken } = await authService.login({
        email: "test@example.com",
        password: "SecurePass123!"
      });

      await expect(
        authService.logout(refreshToken)
      ).resolves.not.toThrow();
    });

    it("handles logout with invalid token gracefully", async () => {
      await expect(
        authService.logout("invalid-token")
      ).resolves.not.toThrow();
    });
  });
});
