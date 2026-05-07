import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Toast Notification Component
 * Displays temporary notification messages with different types
 */
import { memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
export const ToastNotification = memo(function ToastNotification({ toasts, onRemove }) {
    return (_jsx("div", { className: "toast-container", role: "region", "aria-label": "Notifications", children: _jsx(AnimatePresence, { mode: "popLayout", children: toasts.map((toast) => (_jsx(ToastItem, { toast: toast, onRemove: onRemove }, toast.id))) }) }));
});
const ToastItem = memo(function ToastItem({ toast, onRemove }) {
    useEffect(() => {
        const duration = toast.duration || 5000;
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);
    const getIcon = () => {
        switch (toast.type) {
            case "success":
                return (_jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
            case "error":
                return (_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "15", y1: "9", x2: "9", y2: "15" }), _jsx("line", { x1: "9", y1: "9", x2: "15", y2: "15" })] }));
            case "warning":
                return (_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }), _jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }), _jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })] }));
            case "info":
            default:
                return (_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "16", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })] }));
        }
    };
    return (_jsx(motion.div, { className: `toast ${toast.type}`, initial: { opacity: 0, y: 50, scale: 0.95 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }, transition: { type: "spring", stiffness: 500, damping: 30 }, role: "alert", "aria-live": "polite", children: _jsxs("div", { className: "toast-content", children: [_jsx("div", { className: "toast-icon", children: getIcon() }), _jsx("div", { className: "toast-message", children: toast.message }), _jsx("button", { className: "toast-close", onClick: () => onRemove(toast.id), "aria-label": "Close notification", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }) }));
});
// Hook for managing toasts
export function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = (type, message, duration) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const toast = { id, type, message, duration };
        setToasts((prev) => [...prev, toast]);
    };
    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };
    const success = (message, duration) => addToast("success", message, duration);
    const error = (message, duration) => addToast("error", message, duration);
    const info = (message, duration) => addToast("info", message, duration);
    const warning = (message, duration) => addToast("warning", message, duration);
    return {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        info,
        warning
    };
}
// Add missing import
import { useState } from "react";
