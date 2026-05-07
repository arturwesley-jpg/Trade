/**
 * Toast Notification Component
 * Displays temporary notification messages with different types
 */
export interface Toast {
    id: string;
    type: "success" | "error" | "info" | "warning";
    message: string;
    duration?: number;
}
interface ToastNotificationProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}
export declare const ToastNotification: import("react").NamedExoticComponent<ToastNotificationProps>;
export declare function useToast(): {
    toasts: Toast[];
    addToast: (type: Toast["type"], message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
};
export {};
