import React, { useState } from 'react';
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
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <h2>Create Your First Alert</h2>
          <p className="subtitle">Get notified when price reaches your target</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '66%' }}></div>
          </div>
        </div>

        <div className="onboarding-content">
          <div className="tutorial-steps">
            <div className="tutorial-step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>Choose an asset</h4>
                <p>Select the cryptocurrency you want to monitor</p>
              </div>
            </div>

            <div className="tutorial-step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>Set your condition</h4>
                <p>Define when you want to be notified</p>
              </div>
            </div>

            <div className="tutorial-step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>Get notified</h4>
                <p>Receive alerts via email, push, or Telegram</p>
              </div>
            </div>
          </div>

          <div className="alert-form">
            <div className="form-group">
              <label>Asset</label>
              <select
                value={alertData.symbol}
                onChange={(e) => setAlertData(prev => ({ ...prev, symbol: e.target.value }))}
                className="form-control"
              >
                <option value="BTC-USDT">Bitcoin (BTC-USDT)</option>
                <option value="ETH-USDT">Ethereum (ETH-USDT)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Condition</label>
              <select
                value={alertData.condition}
                onChange={(e) => setAlertData(prev => ({ ...prev, condition: e.target.value }))}
                className="form-control"
              >
                <option value="above">Price goes above</option>
                <option value="below">Price goes below</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target Price (USDT)</label>
              <input
                type="number"
                value={alertData.price}
                onChange={(e) => setAlertData(prev => ({ ...prev, price: e.target.value }))}
                className="form-control"
                placeholder="100000"
              />
            </div>

            <div className="alert-preview">
              <span className="preview-icon">🔔</span>
              <p>
                Alert me when <strong>{alertData.symbol}</strong> goes{' '}
                <strong>{alertData.condition}</strong> <strong>${alertData.price}</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="onboarding-actions">
          <button
            className="btn btn-primary btn-large"
            onClick={handleCreateAlert}
          >
            Create Alert
          </button>
          <button
            className="btn btn-text"
            onClick={() => completeStep('first-alert')}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
