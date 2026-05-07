import { randomBytes, createHash } from "node:crypto";
import type { Client } from "pg";

export interface TwoFactorConfig {
  pgClient: Client;
  issuer?: string;
}

export interface TwoFactorSecret {
  userId: string;
  secret: string;
  backupCodes: string[];
}

/**
 * Two-Factor Authentication (2FA) service
 */
export class TwoFactorService {
  private pgClient: Client;
  private issuer: string;

  constructor(config: TwoFactorConfig) {
    this.pgClient = config.pgClient;
    this.issuer = config.issuer ?? "TradingPlatform";
  }

  /**
   * Generate 2FA secret and backup codes
   */
  async generateSecret(userId: string): Promise<TwoFactorSecret> {
    // Generate random secret (base32 encoded)
    const secret = this.generateBase32Secret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(8);

    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

    // Store in database
    await this.pgClient.query(
      `INSERT INTO two_factor_secrets (user_id, secret, backup_codes, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET secret = $2, backup_codes = $3, created_at = $4`,
      [userId, secret, JSON.stringify(hashedBackupCodes), new Date().toISOString()]
    );

    return {
      userId,
      secret,
      backupCodes
    };
  }

  /**
   * Enable 2FA for user
   */
  async enable2FA(userId: string, verificationCode: string): Promise<boolean> {
    // Get secret
    const result = await this.pgClient.query<{ secret: string; enabled: boolean }>(
      `SELECT secret, enabled FROM two_factor_secrets WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error("2FA secret not found. Generate secret first.");
    }

    const { secret, enabled } = result.rows[0];

    if (enabled) {
      throw new Error("2FA is already enabled");
    }

    // Verify code
    const isValid = this.verifyTOTP(secret, verificationCode);

    if (!isValid) {
      throw new Error("Invalid verification code");
    }

    // Enable 2FA
    await this.pgClient.query(
      `UPDATE two_factor_secrets SET enabled = true WHERE user_id = $1`,
      [userId]
    );

    return true;
  }

  /**
   * Disable 2FA for user
   */
  async disable2FA(userId: string): Promise<void> {
    await this.pgClient.query(
      `UPDATE two_factor_secrets SET enabled = false WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(userId: string, code: string): Promise<boolean> {
    // Get secret
    const result = await this.pgClient.query<{ secret: string; enabled: boolean; backup_codes: string }>(
      `SELECT secret, enabled, backup_codes FROM two_factor_secrets WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].enabled) {
      return false;
    }

    const { secret, backup_codes } = result.rows[0];

    // Try TOTP verification first
    if (this.verifyTOTP(secret, code)) {
      return true;
    }

    // Try backup code verification
    const hashedCode = this.hashBackupCode(code);
    const backupCodesList: string[] = JSON.parse(backup_codes);

    const backupCodeIndex = backupCodesList.indexOf(hashedCode);
    if (backupCodeIndex !== -1) {
      // Remove used backup code
      backupCodesList.splice(backupCodeIndex, 1);
      await this.pgClient.query(
        `UPDATE two_factor_secrets SET backup_codes = $1 WHERE user_id = $2`,
        [JSON.stringify(backupCodesList), userId]
      );
      return true;
    }

    return false;
  }

  /**
   * Check if 2FA is enabled for user
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    const result = await this.pgClient.query<{ enabled: boolean }>(
      `SELECT enabled FROM two_factor_secrets WHERE user_id = $1`,
      [userId]
    );

    return result.rows.length > 0 && result.rows[0].enabled;
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

    await this.pgClient.query(
      `UPDATE two_factor_secrets SET backup_codes = $1 WHERE user_id = $2`,
      [JSON.stringify(hashedBackupCodes), userId]
    );

    return backupCodes;
  }

  /**
   * Generate base32 secret
   */
  private generateBase32Secret(): string {
    const buffer = randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString("hex").toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }

  /**
   * Hash backup code for storage
   */
  private hashBackupCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /**
   * Verify TOTP code
   */
  private verifyTOTP(secret: string, code: string): boolean {
    const window = 1; // Allow 1 time step before and after
    const timeStep = 30; // 30 seconds
    const currentTime = Math.floor(Date.now() / 1000);

    for (let i = -window; i <= window; i++) {
      const time = currentTime + i * timeStep;
      const expectedCode = this.generateTOTP(secret, time);

      if (expectedCode === code) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate TOTP code
   */
  private generateTOTP(secret: string, time: number): string {
    const counter = Math.floor(time / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const secretBuffer = this.base32Decode(secret);
    const hmac = createHash("sha1").update(Buffer.concat([secretBuffer, buffer])).digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = (
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, "0");
  }

  /**
   * Base32 encode
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    let output = "";

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decode
   */
  private base32Decode(input: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < input.length; i++) {
      const idx = alphabet.indexOf(input[i].toUpperCase());
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
