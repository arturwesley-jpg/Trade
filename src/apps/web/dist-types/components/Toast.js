import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
export function ToastContainer({ toasts, onRemove }) {
    return (_jsx("div", { className: "toast-container", children: _jsx(AnimatePresence, { children: toasts.map((toast) => (_jsx(ToastItem, { toast: toast, onRemove: onRemove }, toast.id))) }) }));
}
function ToastItem({ toast, onRemove }) {
    useEffect(() => {
        const duration = toast.duration ?? 5000;
        const timer = setTimeout(() => {
            onRemove(toast.id);
        }, duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);
    const icons = {
        success: "✓",
        error: "✕",
        info: "ℹ"
    };
    return (_jsx(motion.div, { className: `toast ${toast.type}`, initial: { opacity: 0, x: 100, scale: 0.8 }, animate: { opacity: 1, x: 0, scale: 1 }, exit: { opacity: 0, x: 100, scale: 0.8 }, transition: { duration: 0.3, ease: "easeOut" }, children: _jsxs("div", { className: "toast-content", children: [_jsx("span", { className: "toast-icon", children: icons[toast.type] }), _jsx("span", { className: "toast-message", children: toast.message })] }) }));
}
// Hook for managing toasts
export function useToast() {
    const [toasts, setToasts] = useState([]);
    const addToast = (type, message, duration) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, type, message, duration }]);
    };
    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };
    return {
        toasts,
        addToast,
        removeToast,
        success: (message, duration) => addToast("success", message, duration),
        error: (message, duration) => addToast("error", message, duration),
        info: (message, duration) => addToast("info", message, duration)
    };
}
