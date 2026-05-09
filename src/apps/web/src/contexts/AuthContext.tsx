import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, LoginResponse } from "@trade/shared";
import { API_BASE_URL } from "../config/api";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load tokens from localStorage on mount
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (storedAccessToken && storedRefreshToken) {
      setAccessToken(storedAccessToken);
      // Verify token and load user
      void verifyAndLoadUser(storedAccessToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  async function verifyAndLoadUser(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.data);
        setAccessToken(token);
      } else {
        // Token invalid, try to refresh
        await refreshToken();
      }
    } catch (error) {
      console.error("Failed to verify token:", error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Login failed");
    }

    const result: { data: LoginResponse } = await response.json();
    const { user, accessToken, refreshToken } = result.data;

    setUser(user);
    setAccessToken(accessToken);
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }

  async function register(email: string, password: string, name?: string) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Registration failed");
    }

    const result: { data: User } = await response.json();

    // After registration, automatically log in
    await login(email, password);
  }

  async function logout() {
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (storedRefreshToken && accessToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken })
        });
      } catch (error) {
        console.error("Logout request failed:", error);
      }
    }

    clearAuth();
  }

  async function refreshToken() {
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (!storedRefreshToken) {
      clearAuth();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken })
      });

      if (!response.ok) {
        clearAuth();
        return;
      }

      const result: { data: { accessToken: string; refreshToken: string } } = await response.json();
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = result.data;

      setAccessToken(newAccessToken);
      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      // Load user with new token
      await verifyAndLoadUser(newAccessToken);
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearAuth();
    }
  }

  function clearAuth() {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
