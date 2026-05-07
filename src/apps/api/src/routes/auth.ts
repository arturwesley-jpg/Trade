import type { Express } from "express";
import type { AuthService } from "../auth/auth-service.js";

export interface AuthRoutesOptions {
  authService: AuthService;
}

export function registerAuthRoutes(app: Express, options: AuthRoutesOptions) {
  const { authService } = options;

  // POST /auth/register
  app.post("/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const result = await authService.register({ email, password, name });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      res.status(400).json({ error: message });
    }
  });

  // POST /auth/login
  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const result = await authService.login({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      res.status(401).json({ error: message });
    }
  });

  // POST /auth/refresh
  app.post("/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token required" });
      }

      const result = await authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token refresh failed";
      res.status(401).json({ error: message });
    }
  });

  // POST /auth/logout
  app.post("/auth/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed";
      res.status(500).json({ error: message });
    }
  });

  // GET /auth/me
  app.get("/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.substring(7);
      const user = await authService.verifyAccessToken(token);
      res.json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      res.status(401).json({ error: message });
    }
  });
}
