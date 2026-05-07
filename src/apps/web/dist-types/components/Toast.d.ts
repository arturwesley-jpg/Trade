export type ToastType = "success" | "error" | "info";
export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}
export interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}
export declare function ToastContainer({ toasts, onRemove }: ToastContainerProps): import("react/jsx-runtime").JSX.Element;
export declare function useToast(): {
    toasts: Toast[];
    addToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
};
