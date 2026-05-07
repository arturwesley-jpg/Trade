import { render } from '@testing-library/react';
/**
 * Test utilities for rendering components with providers
 */
export declare const renderWithProviders: (ui: React.ReactElement) => any;
export declare const mockFetch: (data: any, ok?: boolean) => void;
export declare const mockWebSocket: () => {
    send: import("vitest").Mock<import("@vitest/spy").Procedure>;
    close: import("vitest").Mock<import("@vitest/spy").Procedure>;
    addEventListener: import("vitest").Mock<import("@vitest/spy").Procedure>;
    removeEventListener: import("vitest").Mock<import("@vitest/spy").Procedure>;
    readyState: number;
};
export { render };
