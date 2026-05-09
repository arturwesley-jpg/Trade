/**
 * Centralized API Configuration
 * All API URLs should be imported from here to ensure consistency across the app
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
export const API_WS_URL = import.meta.env.VITE_API_WS_URL ?? "ws://localhost:4000";
