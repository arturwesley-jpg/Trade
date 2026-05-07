import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, memo } from "react";
import { motion } from "framer-motion";
import { useTrading } from "../contexts/TradingContext.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
export const BacktestPanel = memo(function BacktestPanel() {
    const { backtests, isLoading, error, createBacktest, loadBacktests } = useTrading();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        symbol: "BTCUSDT",
        startDate: "",
        endDate: "",
        interval: "1h",
        initialCapital: 10000,
        feeRate: 0.001,
        slippageRate: 0.0005,
        strategyName: "RSI Strategy",
        strategyDescription: "",
        strategyParameters: {
            rsiPeriod: 14,
            oversold: 30,
            overbought: 70
        }
    });
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createBacktest(formData);
            setIsFormOpen(false);
            setFormData({
                name: "",
                description: "",
                symbol: "BTCUSDT",
                startDate: "",
                endDate: "",
                interval: "1h",
                initialCapital: 10000,
                feeRate: 0.001,
                slippageRate: 0.0005,
                strategyName: "RSI Strategy",
                strategyDescription: "",
                strategyParameters: {
                    rsiPeriod: 14,
                    oversold: 30,
                    overbought: 70
                }
            });
        }
        catch (err) {
            console.error("Failed to create backtest:", err);
        }
    };
    const handleInputChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };
    return (_jsx(motion.div, { className: "backtest-panel", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 }, children: _jsxs("div", { className: "panel", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h2", { children: "Backtests" }), _jsx("button", { className: "btn btn-primary", onClick: () => setIsFormOpen(!isFormOpen), disabled: isLoading, children: isFormOpen ? "Cancelar" : "Novo Backtest" })] }), error && (_jsx("div", { className: "alert alert-error", style: { margin: "1rem" }, children: error })), isFormOpen && (_jsxs(motion.form, { className: "backtest-form", onSubmit: handleSubmit, initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 }, style: { padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }, children: [_jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "name", children: "Nome *" }), _jsx("input", { id: "name", type: "text", value: formData.name, onChange: (e) => handleInputChange("name", e.target.value), required: true, placeholder: "Ex: RSI Strategy Test" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "symbol", children: "S\u00EDmbolo *" }), _jsx("input", { id: "symbol", type: "text", value: formData.symbol, onChange: (e) => handleInputChange("symbol", e.target.value.toUpperCase()), required: true, placeholder: "BTCUSDT" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "startDate", children: "Data In\u00EDcio *" }), _jsx("input", { id: "startDate", type: "date", value: formData.startDate, onChange: (e) => handleInputChange("startDate", e.target.value), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "endDate", children: "Data Fim *" }), _jsx("input", { id: "endDate", type: "date", value: formData.endDate, onChange: (e) => handleInputChange("endDate", e.target.value), required: true })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "interval", children: "Intervalo *" }), _jsxs("select", { id: "interval", value: formData.interval, onChange: (e) => handleInputChange("interval", e.target.value), required: true, children: [_jsx("option", { value: "1m", children: "1 minuto" }), _jsx("option", { value: "5m", children: "5 minutos" }), _jsx("option", { value: "15m", children: "15 minutos" }), _jsx("option", { value: "1h", children: "1 hora" }), _jsx("option", { value: "4h", children: "4 horas" }), _jsx("option", { value: "1d", children: "1 dia" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "initialCapital", children: "Capital Inicial *" }), _jsx("input", { id: "initialCapital", type: "number", value: formData.initialCapital, onChange: (e) => handleInputChange("initialCapital", parseFloat(e.target.value)), required: true, min: "0", step: "100" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "feeRate", children: "Taxa de Fee (%) *" }), _jsx("input", { id: "feeRate", type: "number", value: formData.feeRate * 100, onChange: (e) => handleInputChange("feeRate", parseFloat(e.target.value) / 100), required: true, min: "0", max: "10", step: "0.01" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "slippageRate", children: "Taxa de Slippage (%) *" }), _jsx("input", { id: "slippageRate", type: "number", value: formData.slippageRate * 100, onChange: (e) => handleInputChange("slippageRate", parseFloat(e.target.value) / 100), required: true, min: "0", max: "10", step: "0.01" })] }), _jsxs("div", { className: "form-group full-width", children: [_jsx("label", { htmlFor: "description", children: "Descri\u00E7\u00E3o" }), _jsx("textarea", { id: "description", value: formData.description, onChange: (e) => handleInputChange("description", e.target.value), placeholder: "Descri\u00E7\u00E3o opcional do backtest", rows: 3 })] })] }), _jsxs("div", { className: "form-actions", style: { marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }, children: [_jsx("button", { type: "button", className: "btn btn-secondary", onClick: () => setIsFormOpen(false), children: "Cancelar" }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: isLoading, children: isLoading ? "Criando..." : "Criar Backtest" })] })] })), _jsx("div", { className: "backtest-list", children: isLoading && backtests.length === 0 ? (_jsx(LoadingSpinner, { message: "Carregando backtests..." })) : backtests.length === 0 ? (_jsx("p", { className: "empty", style: { padding: "2rem", textAlign: "center" }, children: "Nenhum backtest encontrado. Crie um novo backtest para come\u00E7ar." })) : (_jsx("div", { className: "backtest-grid", children: backtests.map((backtest) => (_jsxs(motion.div, { className: "backtest-card", initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.2 }, children: [_jsxs("div", { className: "backtest-card-header", children: [_jsx("h3", { children: backtest.name }), _jsx("span", { className: `badge badge-${backtest.status}`, children: backtest.status })] }), _jsxs("div", { className: "backtest-card-body", children: [_jsxs("div", { className: "backtest-info", children: [_jsx("span", { className: "label", children: "S\u00EDmbolo:" }), _jsx("span", { className: "value", children: backtest.symbol })] }), _jsxs("div", { className: "backtest-info", children: [_jsx("span", { className: "label", children: "Per\u00EDodo:" }), _jsxs("span", { className: "value", children: [new Date(backtest.startDate).toLocaleDateString(), " - ", new Date(backtest.endDate).toLocaleDateString()] })] }), _jsxs("div", { className: "backtest-info", children: [_jsx("span", { className: "label", children: "Intervalo:" }), _jsx("span", { className: "value", children: backtest.interval })] }), _jsxs("div", { className: "backtest-info", children: [_jsx("span", { className: "label", children: "Capital:" }), _jsxs("span", { className: "value", children: ["$", backtest.initialCapital.toLocaleString()] })] }), backtest.description && (_jsx("p", { className: "backtest-description", children: backtest.description }))] }), _jsx("div", { className: "backtest-card-footer", children: _jsxs("small", { children: ["Criado em ", new Date(backtest.createdAt).toLocaleString()] }) })] }, backtest.id))) })) })] }) }));
});
