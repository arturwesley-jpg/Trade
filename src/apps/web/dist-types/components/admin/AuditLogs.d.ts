export interface AuditLog {
    id: string;
    timestamp: string;
    eventType: string;
    userId?: string;
    userName?: string;
    action: string;
    resource: string;
    details: string;
    ipAddress?: string;
    success: boolean;
}
interface AuditLogsProps {
    logs: AuditLog[];
    onExport?: () => void;
    onRefresh?: () => void;
}
export declare function AuditLogs({ logs, onExport, onRefresh }: AuditLogsProps): import("react/jsx-runtime").JSX.Element;
export {};
