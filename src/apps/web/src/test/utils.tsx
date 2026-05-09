import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext.js';
import { TradingProvider } from '../contexts/TradingContext.js';

/**
 * Test utilities for rendering components with providers
 */

export const renderWithProviders = (ui: React.ReactElement): ReturnType<typeof render> => {
  return render(
    <AuthProvider>
      <TradingProvider>
        {ui}
      </TradingProvider>
    </AuthProvider>
  );
};

export const mockFetch = (data: any, ok = true) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => data,
    headers: new Headers(),
    status: ok ? 200 : 400,
  });
};

export const mockWebSocket = () => {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
  };

  global.WebSocket = vi.fn().mockImplementation(() => mockWs) as any;

  return mockWs;
};

export { render };
