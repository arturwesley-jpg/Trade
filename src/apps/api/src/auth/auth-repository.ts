import type { Client } from "pg";
import type { User, RefreshToken } from "@trade/shared";
import { randomUUID } from "node:crypto";

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name?: string;
  role?: "user" | "admin" | "viewer";
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthRepository {
  constructor(private client: Client) {}

  async createUser(data: CreateUserData): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const role = data.role ?? "user";

    const result = await this.client.query<User>(
      `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, role, created_at as "createdAt", updated_at as "updatedAt",
                 last_login_at as "lastLoginAt", is_active as "isActive"`,
      [id, data.email, data.passwordHash, data.name ?? null, role, now, now, true]
    );

    return result.rows[0];
  }

  async findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    const result = await this.client.query<User & { passwordHash: string }>(
      `SELECT id, email, password_hash as "passwordHash", name, role,
              created_at as "createdAt", updated_at as "updatedAt",
              last_login_at as "lastLoginAt", is_active as "isActive"
       FROM users
       WHERE email = $1 AND is_active = true`,
      [email]
    );

    return result.rows[0] ?? null;
  }

  async findUserById(id: string): Promise<User | null> {
    const result = await this.client.query<User>(
      `SELECT id, email, name, role, created_at as "createdAt", updated_at as "updatedAt",
              last_login_at as "lastLoginAt", is_active as "isActive"
       FROM users
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.client.query(
      `UPDATE users SET last_login_at = $1 WHERE id = $2`,
      [new Date().toISOString(), userId]
    );
  }

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const result = await this.client.query<RefreshToken>(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id as "userId", token_hash as "tokenHash",
                 expires_at as "expiresAt", created_at as "createdAt",
                 revoked_at as "revokedAt", ip_address as "ipAddress", user_agent as "userAgent"`,
      [id, data.userId, data.tokenHash, data.expiresAt.toISOString(), now, data.ipAddress ?? null, data.userAgent ?? null]
    );

    return result.rows[0];
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.client.query<RefreshToken>(
      `SELECT id, user_id as "userId", token_hash as "tokenHash",
              expires_at as "expiresAt", created_at as "createdAt",
              revoked_at as "revokedAt", ip_address as "ipAddress", user_agent as "userAgent"
       FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );

    return result.rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.client.query(
      `UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2`,
      [new Date().toISOString(), tokenHash]
    );
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.client.query(
      `UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL`,
      [new Date().toISOString(), userId]
    );
  }

  async deleteExpiredRefreshTokens(): Promise<number> {
    const result = await this.client.query(
      `DELETE FROM refresh_tokens WHERE expires_at < $1`,
      [new Date().toISOString()]
    );

    return result.rowCount ?? 0;
  }
}
