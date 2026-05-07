import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
export function ExchangeConnection() {
    const { completeStep } = useOnboarding();
    const [selectedExchange, setSelectedExchange] = useState('');
    const exchanges = [
        { id: 'binance', name: 'Binance', icon: '🟡', popular: true },
        { id: 'bybit', name: 'Bybit', icon: '🟠', popular: true },
        { id: 'okx', name: 'OKX', icon: '⚫', popular: false },
        { id: 'kraken', name: 'Kraken', icon: '🔵', popular: false }
    ];
    const handleSkip = () => {
        completeStep('exchange-connection');
    };
    const handleConnect = () => {
        // In a real implementation, this would open exchange connection flow
        completeStep('exchange-connection');
    };
    return (_jsx("div", { className: "onboarding-overlay", children: _jsxs("div", { className: "onboarding-modal", children: [_jsxs("div", { className: "onboarding-header", children: [_jsx("h2", { children: "Connect Your Exchange" }), _jsx("p", { className: "subtitle", children: "Optional: Connect to execute live trades" }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: '50%' } }) })] }), _jsxs("div", { className: "onboarding-content", children: [_jsxs("div", { className: "info-banner", children: [_jsx("span", { className: "info-icon", children: "\u2139\uFE0F" }), _jsxs("div", { className: "info-text", children: [_jsx("strong", { children: "You can skip this step" }), _jsx("p", { children: "Start with paper trading and connect your exchange later when you're ready." })] })] }), _jsx("div", { className: "exchange-list", children: exchanges.map(exchange => (_jsxs("label", { className: "exchange-card", children: [_jsx("input", { type: "radio", name: "exchange", value: exchange.id, checked: selectedExchange === exchange.id, onChange: (e) => setSelectedExchange(e.target.value) }), _jsxs("div", { className: "exchange-content", children: [_jsx("span", { className: "exchange-icon", children: exchange.icon }), _jsx("span", { className: "exchange-name", children: exchange.name }), exchange.popular && (_jsx("span", { className: "exchange-badge", children: "Popular" }))] })] }, exchange.id))) }), _jsxs("div", { className: "security-note", children: [_jsx("h4", { children: "\uD83D\uDD12 Security First" }), _jsxs("ul", { children: [_jsx("li", { children: "API keys are encrypted at rest" }), _jsx("li", { children: "We never store withdrawal permissions" }), _jsx("li", { children: "Read-only access for market data" }), _jsx("li", { children: "Trade execution requires explicit permission" })] })] })] }), _jsxs("div", { className: "onboarding-actions", children: [_jsx("button", { className: "btn btn-primary btn-large", onClick: handleConnect, disabled: !selectedExchange, children: "Connect Exchange" }), _jsx("button", { className: "btn btn-secondary", onClick: handleSkip, children: "Skip - Use Paper Trading" })] })] }) }));
}
