import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Order Book Component
 * Real-time order book visualization with depth analysis
 */
import { memo, useState, useEffect } from "react";
import { motion } from "framer-motion";
export const OrderBook = memo(function OrderBook({ symbol }) {
    const [bids, setBids] = useState([]);
    const [asks, setAsks] = useState([]);
    const [precision, setPrecision] = useState(2);
    // Mock data generator for demonstration
    useEffect(() => {
        const generateMockData = () => {
            const basePrice = 45000;
            const mockBids = [];
            const mockAsks = [];
            let bidTotal = 0;
            for (let i = 0; i < 15; i++) {
                const price = basePrice - (i * 10);
                const amount = Math.random() * 2 + 0.1;
                bidTotal += amount;
                mockBids.push({ price, amount, total: bidTotal });
            }
            let askTotal = 0;
            for (let i = 0; i < 15; i++) {
                const price = basePrice + (i * 10);
                const amount = Math.random() * 2 + 0.1;
                askTotal += amount;
                mockAsks.push({ price, amount, total: askTotal });
            }
            setBids(mockBids);
            setAsks(mockAsks);
        };
        generateMockData();
        const interval = setInterval(generateMockData, 3000);
        return () => clearInterval(interval);
    }, []);
    const formatPrice = (price) => {
        return price.toFixed(precision);
    };
    const formatAmount = (amount) => {
        return amount.toFixed(4);
    };
    const getDepthPercentage = (total, maxTotal) => {
        return (total / maxTotal) * 100;
    };
    const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
    const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;
    return (_jsxs("div", { className: "order-book", children: [_jsxs("div", { className: "panel-header", children: [_jsx("h3", { children: "Order Book" }), _jsxs("div", { className: "precision-selector", children: [_jsx("button", { className: `precision-btn ${precision === 0 ? "active" : ""}`, onClick: () => setPrecision(0), children: "0.1" }), _jsx("button", { className: `precision-btn ${precision === 1 ? "active" : ""}`, onClick: () => setPrecision(1), children: "0.01" }), _jsx("button", { className: `precision-btn ${precision === 2 ? "active" : ""}`, onClick: () => setPrecision(2), children: "0.001" })] })] }), _jsxs("div", { className: "order-book-content", children: [_jsxs("div", { className: "order-book-header", children: [_jsx("span", { className: "col-price", children: "Price (USDT)" }), _jsx("span", { className: "col-amount", children: "Amount" }), _jsx("span", { className: "col-total", children: "Total" })] }), _jsx("div", { className: "order-book-asks", children: asks.slice(0, 10).reverse().map((ask, index) => (_jsxs(motion.div, { className: "order-book-row ask", initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.2, delay: index * 0.02 }, children: [_jsx("div", { className: "depth-bar ask-bar", style: { width: `${getDepthPercentage(ask.total, maxAskTotal)}%` } }), _jsx("span", { className: "col-price ask-price", children: formatPrice(ask.price) }), _jsx("span", { className: "col-amount", children: formatAmount(ask.amount) }), _jsx("span", { className: "col-total", children: formatAmount(ask.total) })] }, `ask-${index}`))) }), _jsx("div", { className: "order-book-spread", children: _jsx("div", { className: "spread-info", children: bids.length > 0 && asks.length > 0 && (_jsxs(_Fragment, { children: [_jsx("span", { className: "spread-label", children: "Spread:" }), _jsxs("span", { className: "spread-value", children: ["$", (asks[0].price - bids[0].price).toFixed(2)] }), _jsxs("span", { className: "spread-percentage", children: ["(", (((asks[0].price - bids[0].price) / bids[0].price) * 100).toFixed(3), "%)"] })] })) }) }), _jsx("div", { className: "order-book-bids", children: bids.slice(0, 10).map((bid, index) => (_jsxs(motion.div, { className: "order-book-row bid", initial: { opacity: 0, x: -10 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.2, delay: index * 0.02 }, children: [_jsx("div", { className: "depth-bar bid-bar", style: { width: `${getDepthPercentage(bid.total, maxBidTotal)}%` } }), _jsx("span", { className: "col-price bid-price", children: formatPrice(bid.price) }), _jsx("span", { className: "col-amount", children: formatAmount(bid.amount) }), _jsx("span", { className: "col-total", children: formatAmount(bid.total) })] }, `bid-${index}`))) })] })] }));
});
