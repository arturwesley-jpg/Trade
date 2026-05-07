import React, { useState } from 'react';
import { useOnboarding } from './OnboardingContext';
import type { RiskTolerance, TradingExperience, UserPreferences } from './types';

export function AccountSetup() {
  const { completeStep, updatePreferences, skipOnboarding } = useOnboarding();

  const [formData, setFormData] = useState<Partial<UserPreferences>>({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePreferences(formData);
    completeStep('account-setup');
  };

  const toggleAsset = (asset: string) => {
    setFormData(prev => ({
      ...prev,
      preferredAssets: prev.preferredAssets?.includes(asset)
        ? prev.preferredAssets.filter(a => a !== asset)
        : [...(prev.preferredAssets || []), asset]
    }));
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      tradingGoals: prev.tradingGoals?.includes(goal)
        ? prev.tradingGoals.filter(g => g !== goal)
        : [...(prev.tradingGoals || []), goal]
    }));
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal onboarding-modal-large">
        <div className="onboarding-header">
          <h2>Set Up Your Trading Profile</h2>
          <p className="subtitle">Help us personalize your experience</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '33%' }}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-section">
            <label className="form-label">Trading Experience</label>
            <div className="radio-group">
              <label className="radio-card">
                <input
                  type="radio"
                  name="experience"
                  value="beginner"
                  checked={formData.tradingExperience === 'beginner'}
                  onChange={(e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value as TradingExperience }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">🌱</span>
                  <span className="radio-title">Beginner</span>
                  <span className="radio-description">New to trading</span>
                </div>
              </label>

              <label className="radio-card">
                <input
                  type="radio"
                  name="experience"
                  value="intermediate"
                  checked={formData.tradingExperience === 'intermediate'}
                  onChange={(e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value as TradingExperience }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">📊</span>
                  <span className="radio-title">Intermediate</span>
                  <span className="radio-description">Some experience</span>
                </div>
              </label>

              <label className="radio-card">
                <input
                  type="radio"
                  name="experience"
                  value="advanced"
                  checked={formData.tradingExperience === 'advanced'}
                  onChange={(e) => setFormData(prev => ({ ...prev, tradingExperience: e.target.value as TradingExperience }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">🚀</span>
                  <span className="radio-title">Advanced</span>
                  <span className="radio-description">Experienced trader</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Risk Tolerance</label>
            <div className="radio-group">
              <label className="radio-card">
                <input
                  type="radio"
                  name="risk"
                  value="conservative"
                  checked={formData.riskTolerance === 'conservative'}
                  onChange={(e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value as RiskTolerance }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">🛡️</span>
                  <span className="radio-title">Conservative</span>
                  <span className="radio-description">Lower risk, steady gains</span>
                </div>
              </label>

              <label className="radio-card">
                <input
                  type="radio"
                  name="risk"
                  value="moderate"
                  checked={formData.riskTolerance === 'moderate'}
                  onChange={(e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value as RiskTolerance }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">⚖️</span>
                  <span className="radio-title">Moderate</span>
                  <span className="radio-description">Balanced approach</span>
                </div>
              </label>

              <label className="radio-card">
                <input
                  type="radio"
                  name="risk"
                  value="aggressive"
                  checked={formData.riskTolerance === 'aggressive'}
                  onChange={(e) => setFormData(prev => ({ ...prev, riskTolerance: e.target.value as RiskTolerance }))}
                />
                <div className="radio-content">
                  <span className="radio-icon">⚡</span>
                  <span className="radio-title">Aggressive</span>
                  <span className="radio-description">Higher risk, higher reward</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Preferred Assets</label>
            <div className="checkbox-group">
              {['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'SOL-USDT'].map(asset => (
                <label key={asset} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={formData.preferredAssets?.includes(asset)}
                    onChange={() => toggleAsset(asset)}
                  />
                  <span className="checkbox-label">{asset}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-section">
            <label className="form-label">Trading Goals</label>
            <div className="checkbox-group">
              {[
                'Learn trading basics',
                'Generate passive income',
                'Test strategies',
                'Automate trading',
                'Risk management'
              ].map(goal => (
                <label key={goal} className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={formData.tradingGoals?.includes(goal)}
                    onChange={() => toggleGoal(goal)}
                  />
                  <span className="checkbox-label">{goal}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="onboarding-actions">
            <button type="submit" className="btn btn-primary btn-large">
              Continue
            </button>
            <button
              type="button"
              className="btn btn-text"
              onClick={skipOnboarding}
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
