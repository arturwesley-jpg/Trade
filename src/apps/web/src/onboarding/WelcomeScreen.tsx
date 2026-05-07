import React from 'react';
import { useOnboarding } from './OnboardingContext';

export function WelcomeScreen() {
  const { completeStep, skipOnboarding } = useOnboarding();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h1>Welcome to Trade Platform</h1>
          <p className="subtitle">Your intelligent trading companion</p>
        </div>

        <div className="onboarding-content">
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Real-time Signals</h3>
              <p>AI-powered trading signals with multi-source data analysis</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Smart Alerts</h3>
              <p>Custom price alerts and notifications via Telegram</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Paper Trading</h3>
              <p>Practice strategies risk-free with simulated trading</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📉</div>
              <h3>Backtesting</h3>
              <p>Test strategies against historical data</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Risk Management</h3>
              <p>Built-in risk controls and position sizing</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Multi-platform</h3>
              <p>Access from web, mobile, and Telegram bot</p>
            </div>
          </div>

          <div className="onboarding-stats">
            <div className="stat">
              <span className="stat-value">5 min</span>
              <span className="stat-label">Setup time</span>
            </div>
            <div className="stat">
              <span className="stat-value">6 steps</span>
              <span className="stat-label">To get started</span>
            </div>
            <div className="stat">
              <span className="stat-value">100%</span>
              <span className="stat-label">Free to try</span>
            </div>
          </div>
        </div>

        <div className="onboarding-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={() => completeStep('welcome')}
          >
            Get Started
          </button>
          <button
            className="btn btn-text"
            onClick={skipOnboarding}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
