import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
export function FirstAlertTutorial() {
    const { completeStep, updateChecklist } = useOnboarding();
    const [alertData, setAlertData] = useState({
        symbol: 'BTC-USDT',
        condition: 'above',
        price: '100000'
    });
    const handleCreateAlert = async () => {
        // In a real implementation, this would call the API
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            updateChecklist({ firstAlertCreated: true });
            completeStep('first-alert');
        }
        catch (error) {
            console.error('Failed to create alert:', error);
        }
    };
    return (_jsx("div", { className: "onboarding-overlay", children: _jsxs("div", { className: "onboarding-modal", children: [_jsxs("div", { className: "onboarding-header", children: [_jsx("h2", { children: "Create Your First Alert" }), _jsx("p", { className: "subtitle", children: "Get notified when price reaches your target" }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: '66%' } }) })] }), _jsxs("div", { className: "onboarding-content", children: [_jsxs("div", { className: "tutorial-steps", children: [_jsxs("div", { className: "tutorial-step", children: [_jsx("span", { className: "step-number", children: "1" }), _jsxs("div", { className: "step-content", children: [_jsx("h4", { children: "Choose an asset" }), _jsx("p", { children: "Select the cryptocurrency you want to monitor" })] })] }), _jsxs("div", { className: "tutorial-step", children: [_jsx("span", { className: "step-number", children: "2" }), _jsxs("div", { className: "step-content", children: [_jsx("h4", { children: "Set your condition" }), _jsx("p", { children: "Define when you want to be notified" })] })] }), _jsxs("div", { className: "tutorial-step", children: [_jsx("span", { className: "step-number", children: "3" }), _jsxs("div", { className: "step-content", children: [_jsx("h4", { children: "Get notified" }), _jsx("p", { children: "Receive alerts via email, push, or Telegram" })] })] })] }), _jsxs("div", { className: "alert-form", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Asset" }), _jsxs("select", { value: alertData.symbol, onChange: (e) => setAlertData(prev => ({ ...prev, symbol: e.target.value })), className: "form-control", children: [_jsx("option", { value: "BTC-USDT", children: "Bitcoin (BTC-USDT)" }), _jsx("option", { value: "ETH-USDT", children: "Ethereum (ETH-USDT)" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Condition" }), _jsxs("select", { value: alertData.condition, onChange: (e) => setAlertData(prev => ({ ...prev, condition: e.target.value })), className: "form-control", children: [_jsx("option", { value: "above", children: "Price goes above" }), _jsx("option", { value: "below", children: "Price goes below" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Target Price (USDT)" }), _jsx("input", { type: "number", value: alertData.price, onChange: (e) => setAlertData(prev => ({ ...prev, price: e.target.value })), className: "form-control", placeholder: "100000" })] }), _jsxs("div", { className: "alert-preview", children: [_jsx("span", { className: "preview-icon", children: "\uD83D\uDD14" }), _jsxs("p", { children: ["Alert me when ", _jsx("strong", { children: alertData.symbol }), " goes", ' ', _jsx("strong", { children: alertData.condition }), " ", _jsxs("strong", { children: ["$", alertData.price] })] })] })] })] }), _jsxs("div", { className: "onboarding-actions", children: [_jsx("button", { className: "btn btn-primary btn-large", onClick: handleCreateAlert, children: "Create Alert" }), _jsx("button", { className: "btn btn-text", onClick: () => completeStep('first-alert'), children: "Skip" })] })] }) }));
}
