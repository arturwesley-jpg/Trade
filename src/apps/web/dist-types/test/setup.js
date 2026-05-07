import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
// Cleanup after each test
afterEach(() => {
    cleanup();
});
// Mock environment variables
vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
vi.stubEnv('VITE_WS_URL', 'ws://localhost:3000');
// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
global.localStorage = localStorageMock;
// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1,
}));
