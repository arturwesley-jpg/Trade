import type { User, LoginResponse } from "@trade/shared";
import { AuthRepository } from "./auth-repository.js";
import { JwtService } from "./jwt-service.js";
import { PasswordService } from "./password-service.js";

export interface AuthServiceConfig {
  authRepository: AuthRepository;
  jwtService: JwtService;
  passwordService: PasswordService;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  private authRepository: AuthRepository;
  private jwtService: JwtService;
  private passwordService: PasswordService;

  constructor(config: AuthServiceConfig) {
    this.authRepository = config.authRepository;
    this.jwtService = config.jwtService;
    this.passwordService = config.passwordService;
  }

  async register(data: RegisterData): Promise<User> {
    // Validate email format
    if (!this.isValidEmail(data.email)) {
      throw new Error("Invalid email format");
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(data.password);
    if (!passwordValidation.valid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(", ")}`);
    }

    // Check if user already exists
    const existingUser = await this.authRepository.findUserByEmail(data.email);
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await this.passwordService.hash(data.password);

    // Create user
    const user = await this.authRepository.createUser({
      email: data.email,
      passwordHash,
      name: data.name
    });

    return user;
  }

  async login(data: LoginData): Promise<LoginResponse> {
    // Find user by email
    const user = await this.authRepository.findUserByEmail(data.email);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isPasswordValid = await this.passwordService.verify(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Update last login
    await this.authRepository.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.jwtService.generateAccessToken(user);
    const refreshToken = this.jwtService.generateRefreshToken();
    const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);

    // Store refresh token
    const expiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiresInSeconds() * 1000);
    await this.authRepository.createRefreshToken({
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent
    });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
      expiresIn: this.jwtService.getAccessTokenExpiresInSeconds()
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);

    // Find refresh token in database
    const storedToken = await this.authRepository.findRefreshToken(refreshTokenHash);
    if (!storedToken) {
      throw new Error("Invalid refresh token");
    }

    // Check if token is expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      await this.authRepository.revokeRefreshToken(refreshTokenHash);
      throw new Error("Refresh token expired");
    }

    // Find user
    const user = await this.authRepository.findUserById(storedToken.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Revoke old refresh token
    await this.authRepository.revokeRefreshToken(refreshTokenHash);

    // Generate new tokens
    const newAccessToken = this.jwtService.generateAccessToken(user);
    const newRefreshToken = this.jwtService.generateRefreshToken();
    const newRefreshTokenHash = this.jwtService.hashRefreshToken(newRefreshToken);

    // Store new refresh token
    const expiresAt = new Date(Date.now() + this.jwtService.getRefreshTokenExpiresInSeconds() * 1000);
    await this.authRepository.createRefreshToken({
      userId: user.id,
      tokenHash: newRefreshTokenHash,
      expiresAt,
      ipAddress: storedToken.ipAddress,
      userAgent: storedToken.userAgent
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.jwtService.getAccessTokenExpiresInSeconds()
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);
    await this.authRepository.revokeRefreshToken(refreshTokenHash);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.authRepository.revokeAllUserRefreshTokens(userId);
  }

  async verifyAccessToken(token: string): Promise<User> {
    const payload = this.jwtService.verifyAccessToken(token);
    const user = await this.authRepository.findUserById(payload.userId);

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
