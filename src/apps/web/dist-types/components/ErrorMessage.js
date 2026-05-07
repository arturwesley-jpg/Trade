import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
export function ErrorMessage({ title = "Erro", message, onRetry }) {
    return (_jsxs(motion.div, { className: "error-message", initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, role: "alert", "aria-live": "assertive", children: [_jsxs("div", { className: "error-content", children: [_jsx("div", { className: "error-icon", "aria-hidden": "true", children: "\u26A0" }), _jsxs("div", { className: "error-text", children: [_jsx("h3", { className: "error-title", children: title }), _jsx("p", { className: "error-description", children: message })] })] }), onRetry && (_jsx("button", { className: "btn btn-secondary", onClick: onRetry, type: "button", children: "Tentar novamente" }))] }));
}
