import { apiBaseUrl } from "../api.js";
// Mock data generators for development/testing
export function generateMockProviders() {
    const providers = ["binance", "bybit", "okx", "kraken", "bingx"];
    const statuses = ["healthy", "healthy", "healthy", "degraded", "healthy"];
    return providers.map((provider, index) => ({
        provider,
        status: statuses[index],
        latencyMs: Math.floor(Math.random() * 300) + 50,
        lastUpdate: new Date().toISOString(),
        dataQuality: 95 + Math.random() * 5,
        priceUsd: 45000 + Math.random() * 1000,
        errorCount: statuses[index] === "degraded" ? Math.floor(Math.random() * 5) : 0
    }));
}
export function generateMockConsensus() {
    const symbols = ["BTC/USDT", "ETH/USDT"];
    return symbols.map((symbol) => {
        const basePrice = symbol.includes("BTC") ? 45500 : 2800;
        const providers = ["binance", "bybit", "okx", "kraken", "bingx"].map((name) => ({
            name,
            price: basePrice + (Math.random() - 0.5) * 100
        }));
        const prices = providers.map((p) => p.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const consensusPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const disagreementPct = ((max - min) / consensusPrice) * 100;
        return {
            symbol,
            consensusPrice,
            priceRange: { min, max },
            disagreementPct,
            providers
        };
    });
}
export function generateMockPaperMetrics() {
    const totalTrades = 50;
    const winningTrades = 32;
    const losingTrades = totalTrades - winningTrades;
    const totalPnl = 1250.75;
    const avgWin = 85.5;
    const avgLoss = -42.3;
    return {
        winRate: (winningTrades / totalTrades) * 100,
        profitFactor: Math.abs((winningTrades * avgWin) / (losingTrades * avgLoss)),
        sharpeRatio: 1.85,
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnl,
        maxDrawdown: -320.5,
        maxDrawdownPct: -8.2,
        avgWin,
        avgLoss,
        largestWin: 245.8,
        largestLoss: -125.3,
        equityCurve: Array.from({ length: 50 }, (_, i) => ({
            timestamp: new Date(Date.now() - (49 - i) * 86400000).toISOString(),
            equity: 10000 + Math.random() * 2000 - 500 + (i * 25)
        })),
        tradesBySymbol: {
            "BTC/USDT": 30,
            "ETH/USDT": 15,
            "SOL/USDT": 5
        }
    };
}
export function generateMockAuditLogs() {
    const eventTypes = ["USER_LOGIN", "ORDER_CREATED", "POSITION_CLOSED", "ALERT_TRIGGERED", "CONFIG_CHANGED"];
    const users = ["admin@trade.com", "trader@trade.com", "system"];
    return Array.from({ length: 100 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: new Date(Date.now() - i * 300000).toISOString(),
        eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        userId: `user-${Math.floor(Math.random() * 3)}`,
        userName: users[Math.floor(Math.random() * users.length)],
        action: "Performed action",
        resource: `/api/v1/resource/${Math.floor(Math.random() * 100)}`,
        details: "Action completed successfully",
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        success: Math.random() > 0.1
    }));
}
export function generateMockSystemHealth() {
    return {
        api: {
            status: "healthy",
            responseTime: Math.floor(Math.random() * 100) + 20,
            uptime: 86400 * 7
        },
        database: {
            status: "connected",
            connectionPool: {
                active: Math.floor(Math.random() * 5) + 2,
                idle: Math.floor(Math.random() * 10) + 5,
                total: 20
            },
            queryTime: Math.floor(Math.random() * 50) + 5
        },
        redis: {
            status: "connected",
            memoryUsed: 256 * 1024 * 1024,
            memoryTotal: 512 * 1024 * 1024,
            hitRate: 95 + Math.random() * 5
        },
        worker: {
            status: "running",
            jobsProcessed: 1250,
            jobsFailed: 12,
            queueSize: Math.floor(Math.random() * 10)
        },
        system: {
            memoryUsage: 2.5 * 1024 * 1024 * 1024,
            memoryTotal: 8 * 1024 * 1024 * 1024,
            cpuUsage: 25 + Math.random() * 30,
            uptime: 86400 * 14
        }
    };
}
// API helper functions
export async function fetchWithAuth(endpoint, options) {
    const token = localStorage.getItem("accessToken");
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
            ...options?.headers,
            Authorization: `Bearer ${token}`
        }
    });
    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data || data;
}
export async function postWithAuth(endpoint, body) {
    return fetchWithAuth(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
}
