import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Signal Card Component
 * Displays trading signal with confidence indicator and actionable insights
 */
import { memo } from "react";
import { motion } from "framer-motion";
export const SignalCard = memo(function SignalCard({ signal, index }) {
    const getDirectionColor = (direction) => {
        switch (direction) {
            case "LONG":
                return "var(--positive)";
            case "SHORT":
                return "var(--negative)";
            default:
                return "var(--muted)";
        }
    };
    const getConfidenceLevel = (confidence) => {
        if (confidence >= 80)
            return { label: "High", color: "var(--positive)" };
        if (confidence >= 60)
            return { label: "Medium", color: "var(--warning)" };
        return { label: "Low", color: "var(--negative)" };
    };
    const confidenceLevel = getConfidenceLevel(signal.confidence);
    return (_jsxs(motion.div, { className: "signal-card", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, transition: { duration: 0.3, delay: index * 0.05 }, style: {
            borderLeft: `3px solid ${getDirectionColor(signal.direction)}`
        }, children: [_jsxs("div", { className: "signal-header", children: [_jsxs("div", { className: "signal-symbol", children: [_jsx("span", { className: "symbol-text", children: signal.symbol }), _jsx("span", { className: "direction-badge", style: { backgroundColor: getDirectionColor(signal.direction) }, children: signal.direction })] }), _jsxs("div", { className: "signal-status", children: [_jsx("span", { className: "status-dot" }), signal.status] })] }), _jsxs("div", { className: "signal-confidence", children: [_jsxs("div", { className: "confidence-label", children: [_jsx("span", { children: "Confidence" }), _jsx("span", { style: { color: confidenceLevel.color, fontWeight: 700 }, children: confidenceLevel.label })] }), _jsx("div", { className: "confidence-bar", children: _jsx(motion.div, { className: "confidence-fill", initial: { width: 0 }, animate: { width: `${signal.confidence}%` }, transition: { duration: 0.8, delay: 0.2 }, style: { backgroundColor: confidenceLevel.color } }) }), _jsxs("div", { className: "confidence-value", children: [signal.confidence, "%"] })] }), (signal.reason || signal.rationale) && (_jsx("div", { className: "signal-rationale", children: _jsx("p", { children: signal.reason || signal.rationale }) })), signal.spreadPct !== undefined && (_jsxs("div", { className: "signal-spread", children: [_jsx("span", { className: "spread-label", children: "Spread:" }), _jsxs("span", { className: "spread-value", children: [signal.spreadPct.toFixed(3), "%"] })] })), signal.sources && signal.sources.length > 0 && (_jsxs("div", { className: "signal-sources", children: [_jsx("span", { className: "sources-label", children: "Sources:" }), _jsx("div", { className: "sources-list", children: signal.sources.map((source, idx) => (_jsx("span", { className: "source-tag", children: source }, idx))) })] }))] }));
});
