import React, { useState } from 'react';
import { useOnboarding } from './OnboardingContext';

export function ExchangeConnection() {
  const { completeStep } = useOnboarding();
  const [selectedExchange, setSelectedExchange] = useState<string>('');

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

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h2>Connect Your Exchange</h2>
          <p className="subtitle">Optional: Connect to execute live trades</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '50%' }}></div>
          </div>
        </div>

        <div className="onboarding-content">
          <div className="info-banner">
            <span className="info-icon">ℹ️</span>
            <div className="info-text">
              <strong>You can skip this step</strong>
              <p>Start with paper trading and connect your exchange later when you're ready.</p>
            </div>
          </div>

          <div className="exchange-list">
            {exchanges.map(exchange => (
              <label key={exchange.id} className="exchange-card">
                <input
                  type="radio"
                  name="exchange"
                  value={exchange.id}
                  checked={selectedExchange === exchange.id}
                  onChange={(e) => setSelectedExchange(e.target.value)}
                />
                <div className="exchange-content">
                  <span className="exchange-icon">{exchange.icon}</span>
                  <span className="exchange-name">{exchange.name}</span>
                  {exchange.popular && (
                    <span className="exchange-badge">Popular</span>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="security-note">
            <h4>🔒 Security First</h4>
            <ul>
              <li>API keys are encrypted at rest</li>
              <li>We never store withdrawal permissions</li>
              <li>Read-only access for market data</li>
              <li>Trade execution requires explicit permission</li>
            </ul>
          </div>
        </div>

        <div className="onboarding-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={handleConnect}
            disabled={!selectedExchange}
          >
            Connect Exchange
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleSkip}
          >
            Skip - Use Paper Trading
          </button>
        </div>
      </div>
    </div>
  );
}
