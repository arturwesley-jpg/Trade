import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiBaseUrl } from "../api.js";
const TradingContext = createContext(undefined);
/**
 * TradingProvider component
 * Provides global trading state management for the application
 *
 * @param children - Child components that will have access to trading context
 */
export function TradingProvider({ children }) {
    const [candles, setCandles] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [backtests, setBacktests] = useState([]);
    const [signals, setSignals] = useState([]);
    const [positions, setPositions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    /**
     * Refresh performance metrics from the API
     * Fetches the latest trading performance metrics and updates state
     */
    const refreshMetrics = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const accessToken = localStorage.getItem("accessToken");
            const headers = {
                "Content-Type": "application/json"
            };
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            }
            const response = await fetch(`${apiBaseUrl}/paper/summary`, {
                headers
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to fetch metrics");
            }
            const result = await response.json();
            // Transform PaperSummary to PerformanceMetrics if needed
            // For now, we'll set it to null as the API returns PaperSummary, not PerformanceMetrics
            // This can be enhanced later to calculate metrics from trades
            setMetrics(null);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            setError(message);
            console.error("Failed to refresh metrics:", err);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    /**
     * Load backtests from the API
     * Fetches all backtests for the current user and updates state
     */
    const loadBacktests = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const accessToken = localStorage.getItem("accessToken");
            const headers = {
                "Content-Type": "application/json"
            };
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            }
            const response = await fetch(`${apiBaseUrl}/backtests`, {
                headers
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to load backtests");
            }
            const result = await response.json();
            setBacktests(result.data.backtests || []);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            setError(message);
            console.error("Failed to load backtests:", err);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    /**
     * Create a new backtest
     * Submits a backtest request to the API and reloads the backtest list
     *
     * @param params - Backtest configuration parameters
     * @throws Error if the backtest creation fails
     */
    const createBacktest = useCallback(async (params) => {
        setIsLoading(true);
        setError(null);
        try {
            const accessToken = localStorage.getItem("accessToken");
            const headers = {
                "Content-Type": "application/json"
            };
            if (accessToken) {
                headers["Authorization"] = `Bearer ${accessToken}`;
            }
            const requestBody = {
                name: params.name,
                description: params.description,
                symbol: params.symbol,
                startDate: params.startDate,
                endDate: params.endDate,
                interval: params.interval,
                initialCapital: params.initialCapital,
                feeRate: params.feeRate,
                slippageRate: params.slippageRate,
                strategyName: params.strategyName,
                strategyDescription: params.strategyDescription,
                strategyParameters: params.strategyParameters
            };
            const response = await fetch(`${apiBaseUrl}/backtests`, {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to create backtest");
            }
            // Reload backtests after successful creation
            await loadBacktests();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error occurred";
            setError(message);
            console.error("Failed to create backtest:", err);
            throw err; // Re-throw so caller can handle it
        }
        finally {
            setIsLoading(false);
        }
    }, [loadBacktests]);
    /**
     * Add a new candle to the state
     * Appends a candle and maintains a maximum of 1000 candles
     *
     * @param candle - The candle data to add
     */
    const addCandle = useCallback((candle) => {
        setCandles((prev) => {
            // Add new candle and keep last 1000 candles
            const updated = [...prev, candle];
            return updated.slice(-1000);
        });
    }, []);
    // Load initial data on mount
    useEffect(() => {
        void loadBacktests();
    }, [loadBacktests]);
    const value = {
        candles,
        metrics,
        backtests,
        signals,
        positions,
        isLoading,
        error,
        refreshMetrics,
        loadBacktests,
        createBacktest,
        addCandle
    };
    return _jsx(TradingContext.Provider, { value: value, children: children });
}
/**
 * Hook to access trading context
 * Must be used within a TradingProvider
 *
 * @returns Trading context value with state and actions
 * @throws Error if used outside of TradingProvider
 */
export function useTrading() {
    const context = useContext(TradingContext);
    if (context === undefined) {
        throw new Error("useTrading must be used within a TradingProvider");
    }
    return context;
}
