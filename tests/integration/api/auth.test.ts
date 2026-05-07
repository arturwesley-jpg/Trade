import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestServer, cleanupDatabase } from '../helpers/setup';
import { createTestUser } from '../helpers/factories';
import type { FastifyInstance } from 'fastify';

describe('Auth API Integration Tests', () => {
  let server: FastifyInstance;
  let testUser: any;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await server.close();
    await cleanupDatabase();
  });

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User'
        }
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user.email).toBe('newuser@example.com');
    });

    it('should reject registration with existing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: testUser.email,
          password: 'SecurePass123!',
          name: 'Duplicate User'
        }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('already exists');
    });

    it('should reject registration with weak password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'weak@example.com',
          password: '123',
          name: 'Weak Password User'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('password');
    });

    it('should reject registration with invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'SecurePass123!',
          name: 'Invalid Email User'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain('email');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('refreshToken');
      expect(body.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'wrongpassword'
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123'
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('Invalid credentials');
    });

    it('should rate limit login attempts', async () => {
      const attempts = Array.from({ length: 6 }, () =>
        server.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: {
            email: testUser.email,
            password: 'wrongpassword'
          }
        })
      );

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.statusCode).toBe(429);
      expect(lastResponse.json().message).toContain('Too many requests');
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeEach(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'password123'
        }
      });
      token = loginResponse.json().token;
    });

    it('should get user profile with valid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.email).toBe(testUser.email);
      expect(body).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me'
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('token');
    });

    it('should reject request with invalid token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token-12345'
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('Invalid token');
    });

    it('should reject request with expired token', async () => {
      // Create an expired token (this would need a helper function)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adcj0vTIX8kJfKXxJE0KfXKXxJE0KfXKXxJE0KfXKXxJE0';

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('expired');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'password123'
        }
      });
      refreshToken = loginResponse.json().refreshToken;
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('refreshToken');
      expect(body.token).not.toBe(refreshToken);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'invalid-refresh-token'
        }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain('Invalid refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    let token: string;

    beforeEach(async () => {
      const loginResponse = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: 'password123'
        }
      });
      token = loginResponse.json().token;
    });

    it('should logout successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().message).toContain('Logged out');
    });

    it('should invalidate token after logout', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
