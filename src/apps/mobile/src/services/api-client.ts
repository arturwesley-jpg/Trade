import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '@/types';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.tradepro.com/api';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.accessToken) {
          this.accessToken = await SecureStore.getItemAsync('accessToken');
        }

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (refreshToken) {
              const response = await this.client.post('/auth/refresh', {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data;

              await this.setTokens(accessToken, newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.clearTokens();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
  }

  async clearTokens() {
    this.accessToken = null;
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', credentials);
    await this.setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/register', data);
    await this.setTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      await this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  // Market data endpoints
  async getMarketData(symbols?: string[]) {
    const params = symbols ? { symbols: symbols.join(',') } : {};
    const response = await this.client.get('/market-data', { params });
    return response.data;
  }

  async getMarketDataBySymbol(symbol: string) {
    const response = await this.client.get(`/market-data/${symbol}`);
    return response.data;
  }

  // Signals endpoints
  async getSignals(params?: { symbol?: string; limit?: number }) {
    const response = await this.client.get('/signals', { params });
    return response.data;
  }

  async getSignalById(id: string) {
    const response = await this.client.get(`/signals/${id}`);
    return response.data;
  }

  // Alerts endpoints
  async getAlerts() {
    const response = await this.client.get('/alerts');
    return response.data;
  }

  async createAlert(data: {
    symbol: string;
    condition: 'above' | 'below';
    targetPrice: number;
  }) {
    const response = await this.client.post('/alerts', data);
    return response.data;
  }

  async deleteAlert(id: string) {
    await this.client.delete(`/alerts/${id}`);
  }

  async updateAlert(id: string, data: { isActive?: boolean; targetPrice?: number }) {
    const response = await this.client.patch(`/alerts/${id}`, data);
    return response.data;
  }

  // Orders endpoints
  async getOrders(params?: { status?: string; limit?: number }) {
    const response = await this.client.get('/orders', { params });
    return response.data;
  }

  async createOrder(data: {
    symbol: string;
    type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }) {
    const response = await this.client.post('/orders', data);
    return response.data;
  }

  async cancelOrder(id: string) {
    await this.client.delete(`/orders/${id}`);
  }

  // Portfolio endpoints
  async getPortfolio() {
    const response = await this.client.get('/portfolio');
    return response.data;
  }

  async getMetrics() {
    const response = await this.client.get('/metrics');
    return response.data;
  }
}

export const apiClient = new ApiClient();
