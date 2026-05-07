export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds
export async function fetchHealth() {
    return requestJson("/health");
}
export async function fetchMarketTicks() {
    return requestJson("/market/ticker");
}
export async function fetchSignals() {
    return requestJson("/signals");
}
export async function fetchProviderStatuses() {
    return requestJson("/market/providers/status");
}
export async function fetchPositions() {
    return requestJson("/positions");
}
export async function fetchAlerts() {
    return requestJson("/alerts");
}
export async function fetchSentimentSnapshot() {
    return requestJson("/sentiment/fear-greed");
}
export async function fetchWhaleEvents() {
    return requestJson("/whales/events");
}
export async function fetchPaperSummary() {
    return requestJson("/paper/summary");
}
export async function openPaperOrder(payload) {
    return requestJson("/orders/paper", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST"
    });
}
// New specific API functions for backtests and metrics
export async function getBacktests() {
    return requestJsonWithRetry("/backtests");
}
export async function createBacktest(params) {
    return requestJsonWithRetry("/backtests", {
        body: JSON.stringify(params),
        headers: { "Content-Type": "application/json" },
        method: "POST"
    });
}
export async function getMetrics() {
    return requestJsonWithRetry("/metrics/performance");
}
// Helper function to create timeout promise
function createTimeoutPromise(timeoutMs) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            const error = {
                message: `Request timeout after ${timeoutMs}ms`,
                code: "TIMEOUT",
                isTimeout: true
            };
            reject(error);
        }, timeoutMs);
    });
}
// Helper function to check if error is retryable
function isRetryableError(error) {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.isNetworkError || error.isTimeout) {
        return true;
    }
    if (error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
        return true;
    }
    // Also retry on 429 (rate limit)
    if (error.statusCode === 429) {
        return true;
    }
    return false;
}
// Helper function to calculate exponential backoff delay
function getRetryDelay(attempt) {
    return INITIAL_RETRY_DELAY * Math.pow(2, attempt);
}
// Helper function to sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Wrapper function with retry logic and exponential backoff
export async function requestJsonWithRetry(path, init, retryCount = 0) {
    try {
        return await Promise.race([
            requestJson(path, init),
            createTimeoutPromise(REQUEST_TIMEOUT)
        ]);
    }
    catch (error) {
        const apiError = error;
        // If we haven't exceeded max retries and error is retryable, retry
        if (retryCount < MAX_RETRIES && isRetryableError(apiError)) {
            const delay = getRetryDelay(retryCount);
            await sleep(delay);
            return requestJsonWithRetry(path, init, retryCount + 1);
        }
        // Otherwise, throw the error
        throw apiError;
    }
}
async function requestJson(path, init) {
    const accessToken = localStorage.getItem("accessToken");
    const headers = new Headers(init?.headers);
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
    }
    let response;
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            ...init,
            headers
        });
    }
    catch (error) {
        // Network error (no response received)
        const networkError = {
            message: error instanceof Error ? error.message : "Network error",
            code: "NETWORK_ERROR",
            isNetworkError: true
        };
        throw networkError;
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = typeof payload?.error?.message === "string"
            ? payload.error.message
            : typeof payload?.message === "string"
                ? payload.message
                : `HTTP ${response.status}`;
        const apiError = {
            message,
            code: payload?.error?.code || payload?.code,
            statusCode: response.status
        };
        throw apiError;
    }
    if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
    }
    return payload;
}
