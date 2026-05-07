import type { AlertEvent } from "../../shared-types.js";
interface AlertManagementProps {
    alerts: AlertEvent[];
    onAcknowledge: (alertId: string) => Promise<void>;
    onResolve: (alertId: string) => Promise<void>;
    onCreate?: (alert: CreateAlertRequest) => Promise<void>;
}
export interface CreateAlertRequest {
    type: AlertEvent["type"];
    title: string;
    message: string;
    severity: AlertEvent["severity"];
}
export declare function AlertManagement({ alerts, onAcknowledge, onResolve, onCreate }: AlertManagementProps): import("react/jsx-runtime").JSX.Element;
export {};
