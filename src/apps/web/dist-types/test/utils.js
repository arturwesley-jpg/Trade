import { jsx as _jsx } from "react/jsx-runtime";
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext.js';
import { TradingProvider } from '../contexts/TradingContext.js';
/**
 * Test utilities for rendering components with providers
 */
export const renderWithProviders = (ui) => {
    return render(_jsx(AuthProvider, { children: _jsx(TradingProvider, { children: ui }) }));
};
export const mockFetch = (data, ok = true) => {
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
    global.WebSocket = vi.fn().mockImplementation(() => mockWs);
    return mockWs;
};
export { render };
