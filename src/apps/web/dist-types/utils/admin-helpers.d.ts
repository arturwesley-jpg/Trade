export declare function generateMockProviders(): {
    provider: "binance" | "bybit" | "okx" | "kraken" | "bingx";
    status: "healthy" | "degraded";
    latencyMs: number;
    lastUpdate: string;
    dataQuality: number;
    priceUsd: number;
    errorCount: number;
}[];
export declare function generateMockConsensus(): {
    symbol: string;
    consensusPrice: number;
    priceRange: {
        min: number;
        max: number;
    };
    disagreementPct: number;
    providers: {
        name: string;
        price: number;
    }[];
}[];
export declare function generateMockPaperMetrics(): {
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    equityCurve: {
        timestamp: string;
        equity: number;
    }[];
    tradesBySymbol: {
        "BTC/USDT": number;
        "ETH/USDT": number;
        "SOL/USDT": number;
    };
};
export declare function generateMockAuditLogs(): {
    id: string;
    timestamp: string;
    eventType: string;
    userId: string;
    userName: string;
    action: string;
    resource: string;
    details: string;
    ipAddress: string;
    success: boolean;
}[];
export declare function generateMockSystemHealth(): {
    api: {
        status: "healthy";
        responseTime: number;
        uptime: number;
    };
    database: {
        status: "connected";
        connectionPool: {
            active: number;
            idle: number;
            total: number;
        };
        queryTime: number;
    };
    redis: {
        status: "connected";
        memoryUsed: number;
        memoryTotal: number;
        hitRate: number;
    };
    worker: {
        status: "running";
        jobsProcessed: number;
        jobsFailed: number;
        queueSize: number;
    };
    system: {
        memoryUsage: number;
        memoryTotal: number;
        cpuUsage: number;
        uptime: number;
    };
};
export declare function fetchWithAuth(endpoint: string, options?: RequestInit): Promise<any>;
export declare function postWithAuth(endpoint: string, body: any): Promise<any>;
