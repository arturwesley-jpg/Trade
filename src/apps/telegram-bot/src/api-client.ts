/**
 * API Client for Telegram Bot
 * Handles API communication with proper error handling and data extraction
 */

export interface ApiError {
  error: string;
  message?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Fetches data from the API and extracts the data field if present
 * @param endpoint - API endpoint path (e.g., "/health", "/signals")
 * @param baseUrl - Base URL of the API
 * @returns Typed data from the API response
 * @throws Error if the request fails or API returns an error
 */
export async function fetchApi<T>(endpoint: string, baseUrl: string): Promise<T> {
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const payload: ApiResponse<T> = await response.json();

    // Check if API returned an error
    if (payload.error) {
      throw new Error(payload.message || payload.error);
    }

    // Extract data field if present, otherwise return the whole payload
    return (payload.data !== undefined ? payload.data : payload) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch ${endpoint}: ${String(error)}`);
  }
}

/**
 * Formats error messages for Telegram
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `❌ Erro: ${error.message}`;
  }
  return `❌ Erro desconhecido: ${String(error)}`;
}
