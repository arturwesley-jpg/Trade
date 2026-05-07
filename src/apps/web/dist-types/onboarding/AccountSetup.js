import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
export function AccountSetup() {
    const { completeStep, updatePreferences, skipOnboarding } = useOnboarding();
    const [formData, setFormData] = useState({
        riskTolerance: 'moderate',
        tradingExperience: 'beginner',
        preferredAssets: ['BTC-USDT'],
        tradingGoals: [],
        notificationPreferences: {
            email: true,
            telegram: false,
            push: true,
            priceAlerts: true,
            signalAlerts: true,
            tradeExecutions: true,
            dailySummary: false
        }
    });
    const handleSubmit = (e) => {
        e.preventDefault();
        updatePreferences(formData);
        completeStep('account-setup');
    };
    const toggleAsset = (asset) => {
        setFormData(prev => ({
            ...prev,
            preferredAssets: prev.preferredAssets?.includes(asset)
                ? prev.preferredAssets.filter(a => a !== asset)
                : [...(prev.preferredAssets || []), asset]
        }));
    };
    const toggleGoal = (goal) => {
        setFormData(prev => ({
            ...prev,
            tradingGoals: prev.tradingGoals?.includes(goal)
                ? prev.tradingGoals.filter(g => g !== goal)
                : [...(prev.tradingGoals || []), goal]
        }));
    };
    return (_jsx("div", { className: "onboarding-overlay", children: _jsxs("div", { className: "onboarding-modal onboarding-modal-large", children: [_jsxs("div", { className: "onboarding-header", children: [_jsx("h2", { children: "Set Up Your Trading Profile" }), _jsx("p", { className: "subtitle", children: "Help us personalize your experience" }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: '33%' } }) })] }), _jsxs("form", { onSubmit: handleSubmit, className: "onboarding-form", children: [_jsxs("div", { className: "form-section", children: [_jsx("label", { className: "form-label", children: "Trading Experience" }), _jsxs("div", { className: "radio-group", children: [_jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "experience", value: "beginner", checked: formData.tradingExperience === 'beginner', onChange: (e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\uD83C\uDF31" }), _jsx("span", { className: "radio-title", children: "Beginner" }), _jsx("span", { className: "radio-description", children: "New to trading" })] })] }), _jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "experience", value: "intermediate", checked: formData.tradingExperience === 'intermediate', onChange: (e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\uD83D\uDCCA" }), _jsx("span", { className: "radio-title", children: "Intermediate" }), _jsx("span", { className: "radio-description", children: "Some experience" })] })] }), _jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "experience", value: "advanced", checked: formData.tradingExperience === 'advanced', onChange: (e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\uD83D\uDE80" }), _jsx("span", { className: "radio-title", children: "Advanced" }), _jsx("span", { className: "radio-description", children: "Experienced trader" })] })] })] })] }), _jsxs("div", { className: "form-section", children: [_jsx("label", { className: "form-label", children: "Risk Tolerance" }), _jsxs("div", { className: "radio-group", children: [_jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "risk", value: "conservative", checked: formData.riskTolerance === 'conservative', onChange: (e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\uD83D\uDEE1\uFE0F" }), _jsx("span", { className: "radio-title", children: "Conservative" }), _jsx("span", { className: "radio-description", children: "Lower risk, steady gains" })] })] }), _jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "risk", value: "moderate", checked: formData.riskTolerance === 'moderate', onChange: (e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\u2696\uFE0F" }), _jsx("span", { className: "radio-title", children: "Moderate" }), _jsx("span", { className: "radio-description", children: "Balanced approach" })] })] }), _jsxs("label", { className: "radio-card", children: [_jsx("input", { type: "radio", name: "risk", value: "aggressive", checked: formData.riskTolerance === 'aggressive', onChange: (e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value })) }), _jsxs("div", { className: "radio-content", children: [_jsx("span", { className: "radio-icon", children: "\u26A1" }), _jsx("span", { className: "radio-title", children: "Aggressive" }), _jsx("span", { className: "radio-description", children: "Higher risk, higher reward" })] })] })] })] }), _jsxs("div", { className: "form-section", children: [_jsx("label", { className: "form-label", children: "Preferred Assets" }), _jsx("div", { className: "checkbox-group", children: ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT'].map(asset => (_jsxs("label", { className: "checkbox-card", children: [_jsx("input", { type: "checkbox", checked: formData.preferredAssets?.includes(asset), onChange: () => toggleAsset(asset) }), _jsx("span", { className: "checkbox-label", children: asset })] }, asset))) })] }), _jsxs("div", { className: "form-section", children: [_jsx("label", { className: "form-label", children: "Trading Goals" }), _jsx("div", { className: "checkbox-group", children: [
                                        'Learn trading basics',
                                        'Generate passive income',
                                        'Test strategies',
                                        'Automate trading',
                                        'Risk management'
                                    ].map(goal => (_jsxs("label", { className: "checkbox-card", children: [_jsx("input", { type: "checkbox", checked: formData.tradingGoals?.includes(goal), onChange: () => toggleGoal(goal) }), _jsx("span", { className: "checkbox-label", children: goal })] }, goal))) })] }), _jsxs("div", { className: "onboarding-actions", children: [_jsx("button", { type: "submit", className: "btn btn-primary btn-large", children: "Continue" }), _jsx("button", { type: "button", className: "btn btn-text", onClick: skipOnboarding, children: "Skip" })] })] })] }) }));
}
