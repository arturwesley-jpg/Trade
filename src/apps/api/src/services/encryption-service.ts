import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export interface EncryptionConfig {
  encryptionKey: string;
  algorithm?: string;
}

/**
 * Service for encrypting sensitive data at rest
 */
export class EncryptionService {
  private algorithm: string;
  private encryptionKey: string;

  constructor(config: EncryptionConfig) {
    this.algorithm = config.algorithm ?? "aes-256-gcm";
    this.encryptionKey = config.encryptionKey;

    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error("Encryption key must be at least 32 characters");
    }
  }

  /**
   * Encrypt sensitive data
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      // Generate random IV
      const iv = randomBytes(16);

      // Derive key from encryption key
      const key = (await scryptAsync(this.encryptionKey, "salt", 32)) as Buffer;

      // Create cipher
      const cipher = createCipheriv(this.algorithm, key, iv);

      // Encrypt data
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get auth tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Return IV + authTag + encrypted data
      return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  async decrypt(ciphertext: string): Promise<string> {
    try {
      // Split IV, authTag, and encrypted data
      const parts = ciphertext.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid ciphertext format");
      }

      const iv = Buffer.from(parts[0], "hex");
      const authTag = Buffer.from(parts[1], "hex");
      const encrypted = parts[2];

      // Derive key from encryption key
      const key = (await scryptAsync(this.encryptionKey, "salt", 32)) as Buffer;

      // Create decipher
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  async hash(data: string): Promise<string> {
    const key = (await scryptAsync(data, this.encryptionKey, 32)) as Buffer;
    return key.toString("hex");
  }
}
