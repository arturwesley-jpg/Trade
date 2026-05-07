export interface SystemHealthData {
    api: {
        status: "healthy" | "degraded" | "down";
        responseTime: number;
        uptime: number;
    };
    database: {
        status: "connected" | "disconnected" | "error";
        connectionPool: {
            active: number;
            idle: number;
            total: number;
        };
        queryTime: number;
    };
    redis: {
        status: "connected" | "disconnected" | "error";
        memoryUsed: number;
        memoryTotal: number;
        hitRate: number;
    };
    worker: {
        status: "running" | "stopped" | "error";
        jobsProcessed: number;
        jobsFailed: number;
        queueSize: number;
    };
    system?: {
        memoryUsage: number;
        memoryTotal: number;
        cpuUsage: number;
        uptime: number;
    };
}
interface SystemHealthProps {
    health: SystemHealthData;
    onRefresh?: () => void;
}
export declare function SystemHealth({ health, onRefresh }: SystemHealthProps): import("react/jsx-runtime").JSX.Element;
export {};
