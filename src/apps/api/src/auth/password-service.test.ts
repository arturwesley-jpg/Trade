import { describe, expect, it } from "vitest";
import { PasswordService } from "./password-service.js";

describe("PasswordService", () => {
  const passwordService = new PasswordService();

  describe("validatePasswordStrength", () => {
    it("accepts strong passwords", () => {
      const result = passwordService.validatePasswordStrength("SecurePass123!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = passwordService.validatePasswordStrength("Short1!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must be at least 8 characters long");
    });

    it("rejects passwords without uppercase letters", () => {
      const result = passwordService.validatePasswordStrength("lowercase123!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one uppercase letter");
    });

    it("rejects passwords without lowercase letters", () => {
      const result = passwordService.validatePasswordStrength("UPPERCASE123!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one lowercase letter");
    });

    it("rejects passwords without numbers", () => {
      const result = passwordService.validatePasswordStrength("NoNumbers!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Password must contain at least one number");
    });

    it("accepts passwords with various special characters", () => {
      const passwords = [
        "Password123!",
        "Password123@",
        "Password123#",
        "Password123$",
        "Password123%"
      ];

      for (const password of passwords) {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.valid).toBe(true);
      }
    });

    it("returns multiple errors for very weak passwords", () => {
      const result = passwordService.validatePasswordStrength("weak");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("hashPassword and verifyPassword", () => {
    it("hashes password and verifies correctly", async () => {
      const password = "SecurePass123!";
      const hash = await passwordService.hash(password);

      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$/);

      const isValid = await passwordService.verify(password, hash);
      expect(isValid).toBe(true);
    });

    it("rejects incorrect password", async () => {
      const password = "SecurePass123!";
      const hash = await passwordService.hash(password);

      const isValid = await passwordService.verify("WrongPassword123!", hash);
      expect(isValid).toBe(false);
    });

    it("generates different hashes for same password", async () => {
      const password = "SecurePass123!";
      const hash1 = await passwordService.hash(password);
      const hash2 = await passwordService.hash(password);

      expect(hash1).not.toBe(hash2);

      const isValid1 = await passwordService.verify(password, hash1);
      const isValid2 = await passwordService.verify(password, hash2);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });
});
