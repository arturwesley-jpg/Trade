import { EncryptionService } from "./encryption-service.js";
import type { Client } from "pg";
import { randomUUID } from "node:crypto";

export interface SecretsManagerConfig {
  pgClient: Client;
  encryptionService: EncryptionService;
}

export interface ApiKeyData {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  permissions: string[];
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
}

/**
 * Secure secrets management service
 */
export class SecretsManager {
  private pgClient: Client;
  private encryptionService: EncryptionService;

  constructor(config: SecretsManagerConfig) {
    this.pgClient = config.pgClient;
    this.encryptionService = config.encryptionService;
  }

  /**
   * Store encrypted API key
   */
  async storeApiKey(data: {
    userId: string;
    name: string;
    key: string;
    permissions: string[];
    expiresAt?: Date;
  }): Promise<ApiKeyData> {
    const id = randomUUID();
    const keyHash = await this.encryptionService.hash(data.key);
    const now = new Date().toISOString();

    const result = await this.pgClient.query<ApiKeyData>(
      `INSERT INTO api_keys (id, user_id, name, key_hash, permissions, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id as "userId", name, key_hash as "keyHash", permissions,
                 expires_at as "expiresAt", created_at as "createdAt", last_used_at as "lastUsedAt"`,
      [
        id,
        data.userId,
        data.name,
        keyHash,
        JSON.stringify(data.permissions),
        data.expiresAt?.toISOString() ?? null,
        now
      ]
    );

    return result.rows[0];
  }

  /**
   * Verify API key
   */
  async verifyApiKey(key: string): Promise<ApiKeyData | null> {
    const keyHash = await this.encryptionService.hash(key);

    const result = await this.pgClient.query<ApiKeyData>(
      `SELECT id, user_id as "userId", name, key_hash as "keyHash", permissions,
              expires_at as "expiresAt", created_at as "createdAt", last_used_at as "lastUsedAt"
       FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const apiKey = result.rows[0];

    // Check if expired
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    // Update last used timestamp
    await this.pgClient.query(
      `UPDATE api_keys SET last_used_at = $1 WHERE id = $2`,
      [new Date().toISOString(), apiKey.id]
    );

    return apiKey;
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    await this.pgClient.query(
      `UPDATE api_keys SET revoked_at = $1 WHERE id = $2`,
      [new Date().toISOString(), apiKeyId]
    );
  }

  /**
   * Store encrypted exchange API credentials
   */
  async storeExchangeCredentials(data: {
    userId: string;
    exchange: string;
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }): Promise<string> {
    const id = randomUUID();
    const encryptedApiKey = await this.encryptionService.encrypt(data.apiKey);
    const encryptedApiSecret = await this.encryptionService.encrypt(data.apiSecret);
    const encryptedPassphrase = data.passphrase
      ? await this.encryptionService.encrypt(data.passphrase)
      : null;

    await this.pgClient.query(
      `INSERT INTO exchange_credentials (id, user_id, exchange, encrypted_api_key, encrypted_api_secret, encrypted_passphrase, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, exchange) DO UPDATE SET
         encrypted_api_key = $4,
         encrypted_api_secret = $5,
         encrypted_passphrase = $6,
         updated_at = $7`,
      [
        id,
        data.userId,
        data.exchange,
        encryptedApiKey,
        encryptedApiSecret,
        encryptedPassphrase,
        new Date().toISOString()
      ]
    );

    return id;
  }

  /**
   * Retrieve decrypted exchange credentials
   */
  async getExchangeCredentials(userId: string, exchange: string): Promise<{
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  } | null> {
    const result = await this.pgClient.query<{
      encrypted_api_key: string;
      encrypted_api_secret: string;
      encrypted_passphrase: string | null;
    }>(
      `SELECT encrypted_api_key, encrypted_api_secret, encrypted_passphrase
       FROM exchange_credentials
       WHERE user_id = $1 AND exchange = $2`,
      [userId, exchange]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    const apiKey = await this.encryptionService.decrypt(row.encrypted_api_key);
    const apiSecret = await this.encryptionService.decrypt(row.encrypted_api_secret);
    const passphrase = row.encrypted_passphrase
      ? await this.encryptionService.decrypt(row.encrypted_passphrase)
      : undefined;

    return {
      apiKey,
      apiSecret,
      passphrase
    };
  }

  /**
   * Delete exchange credentials
   */
  async deleteExchangeCredentials(userId: string, exchange: string): Promise<void> {
    await this.pgClient.query(
      `DELETE FROM exchange_credentials WHERE user_id = $1 AND exchange = $2`,
      [userId, exchange]
    );
  }

  /**
   * List user's API keys
   */
  async listApiKeys(userId: string): Promise<ApiKeyData[]> {
    const result = await this.pgClient.query<ApiKeyData>(
      `SELECT id, user_id as "userId", name, key_hash as "keyHash", permissions,
              expires_at as "expiresAt", created_at as "createdAt", last_used_at as "lastUsedAt"
       FROM api_keys
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }
}
