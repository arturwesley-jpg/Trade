import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Trading Panel Component
 * Interactive panel for placing orders with risk management controls
 */
import { memo, useState } from "react";
import { motion } from "framer-motion";
export const TradingPanel = memo(function TradingPanel({ symbol }) {
    const [orderType, setOrderType] = useState("market");
    const [side, setSide] = useState("buy");
    const [amount, setAmount] = useState("");
    const [price, setPrice] = useState("");
    const [leverage, setLeverage] = useState(1);
    const [stopLoss, setStopLoss] = useState("");
    const [takeProfit, setTakeProfit] = useState("");
    const handleSubmit = (e) => {
        e.preventDefault();
        // Order submission logic will be handled by parent
        console.log("Order submitted:", {
            symbol,
            orderType,
            side,
            amount,
            price,
            leverage,
            stopLoss,
            takeProfit
        });
    };
    const leverageOptions = [1, 2, 3, 5, 10, 20];
    return (_jsxs("div", { className: "trading-panel", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "Place Order" }), _jsx("span", { className: "paper-badge", children: "PAPER MODE" })] }), _jsxs("form", { onSubmit: handleSubmit, className: "trading-form", children: [_jsxs("div", { className: "order-type-selector", children: [_jsx("button", { type: "button", className: `order-type-btn ${orderType === "market" ? "active" : ""}`, onClick: () => setOrderType("market"), children: "Market" }), _jsx("button", { type: "button", className: `order-type-btn ${orderType === "limit" ? "active" : ""}`, onClick: () => setOrderType("limit"), children: "Limit" }), _jsx("button", { type: "button", className: `order-type-btn ${orderType === "stop" ? "active" : ""}`, onClick: () => setOrderType("stop"), children: "Stop" })] }), _jsxs("div", { className: "side-selector", children: [_jsx("button", { type: "button", className: `side-btn buy ${side === "buy" ? "active" : ""}`, onClick: () => setSide("buy"), children: "Buy / Long" }), _jsx("button", { type: "button", className: `side-btn sell ${side === "sell" ? "active" : ""}`, onClick: () => setSide("sell"), children: "Sell / Short" })] }), orderType !== "market" && (_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "price", children: "Price (USDT)" }), _jsx("input", { id: "price", type: "number", step: "0.01", value: price, onChange: (e) => setPrice(e.target.value), placeholder: "Enter price", className: "form-input" })] })), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "amount", children: "Amount (USDT)" }), _jsx("input", { id: "amount", type: "number", step: "0.01", value: amount, onChange: (e) => setAmount(e.target.value), placeholder: "Enter amount", className: "form-input", required: true })] }), _jsxs("div", { className: "form-group", children: [_jsxs("label", { children: ["Leverage: ", leverage, "x"] }), _jsx("div", { className: "leverage-selector", children: leverageOptions.map((lev) => (_jsxs("button", { type: "button", className: `leverage-btn ${leverage === lev ? "active" : ""}`, onClick: () => setLeverage(lev), children: [lev, "x"] }, lev))) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "stopLoss", children: "Stop Loss (Optional)" }), _jsx("input", { id: "stopLoss", type: "number", step: "0.01", value: stopLoss, onChange: (e) => setStopLoss(e.target.value), placeholder: "Stop loss price", className: "form-input" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "takeProfit", children: "Take Profit (Optional)" }), _jsx("input", { id: "takeProfit", type: "number", step: "0.01", value: takeProfit, onChange: (e) => setTakeProfit(e.target.value), placeholder: "Take profit price", className: "form-input" })] }), amount && (_jsxs(motion.div, { className: "order-summary", initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, transition: { duration: 0.3 }, children: [_jsxs("div", { className: "summary-row", children: [_jsx("span", { children: "Position Size:" }), _jsxs("span", { className: "summary-value", children: ["$", (parseFloat(amount) * leverage).toFixed(2)] })] }), _jsxs("div", { className: "summary-row", children: [_jsx("span", { children: "Margin Required:" }), _jsxs("span", { className: "summary-value", children: ["$", amount] })] }), stopLoss && (_jsxs("div", { className: "summary-row", children: [_jsx("span", { children: "Max Loss:" }), _jsxs("span", { className: "summary-value negative", children: ["$", Math.abs(parseFloat(amount) * leverage * 0.05).toFixed(2)] })] }))] })), _jsx("button", { type: "submit", className: `submit-btn ${side}`, disabled: !amount, children: side === "buy" ? "Place Buy Order" : "Place Sell Order" }), _jsx("div", { className: "trading-disclaimer", children: _jsx("p", { children: "\u26A0\uFE0F Paper trading mode - No real funds at risk" }) })] })] }));
});
