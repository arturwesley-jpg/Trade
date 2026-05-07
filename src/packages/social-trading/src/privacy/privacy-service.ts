/**
 * Privacy Service
 * Manages privacy controls and risk warnings
 */

import type { TraderProfile, RiskWarning, VisibilityLevel } from '../types.js';

export class PrivacyService {
  /**
   * Check if viewer can see trader's profile
   */
  canViewProfile(
    trader: TraderProfile,
    viewerId: string,
    isFollower: boolean
  ): boolean {
    if (trader.userId === viewerId) return true;

    switch (trader.visibility) {
      case 'public':
        return true;
      case 'followers':
        return isFollower;
      case 'private':
        return false;
      default:
        return false;
    }
  }

  /**
   * Check if viewer can see trader's positions
   */
  canViewPositions(
    trader: TraderProfile,
    viewerId: string,
    isFollower: boolean
  ): boolean {
    return this.canViewProfile(trader, viewerId, isFollower);
  }

  /**
   * Check if viewer can copy trader
   */
  canCopyTrader(
    trader: TraderProfile,
    viewerId: string,
    isFollower: boolean
  ): boolean {
    if (!trader.allowCopying) return false;
    if (trader.userId === viewerId) return false;

    return this.canViewProfile(trader, viewerId, isFollower);
  }

  /**
   * Generate risk warnings for copy trading
   */
  generateCopyTradingWarnings(trader: TraderProfile): RiskWarning[] {
    const warnings: RiskWarning[] = [];

    // High risk trader warning
    if (trader.riskLevel === 'aggressive') {
      warnings.push({
        type: 'high_risk_trader',
        severity: 'warning',
        message: 'This trader uses aggressive strategies with higher risk',
        details: { riskLevel: trader.riskLevel },
      });
    }

    // High drawdown warning
    if (trader.stats.maxDrawdownPercent < -30) {
      warnings.push({
        type: 'high_drawdown',
        severity: 'warning',
        message: `This trader has experienced significant drawdowns (${trader.stats.maxDrawdownPercent.toFixed(1)}%)`,
        details: { maxDrawdown: trader.stats.maxDrawdownPercent },
      });
    }

    // New trader warning
    const accountAge = Date.now() - trader.joinedAt.getTime();
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (daysOld < 30) {
      warnings.push({
        type: 'new_trader',
        severity: 'info',
        message: 'This trader has less than 30 days of trading history',
        details: { daysOld: Math.floor(daysOld) },
      });
    }

    // Low trade count warning
    if (trader.stats.totalTrades < 20) {
      warnings.push({
        type: 'new_trader',
        severity: 'info',
        message: 'This trader has limited trading history',
        details: { totalTrades: trader.stats.totalTrades },
      });
    }

    // Volatile strategy warning
    if (trader.stats.consistencyScore < 50) {
      warnings.push({
        type: 'volatile_strategy',
        severity: 'warning',
        message: 'This trader shows inconsistent performance',
        details: { consistencyScore: trader.stats.consistencyScore },
      });
    }

    return warnings;
  }

  /**
   * Generate general risk disclaimer
   */
  getGeneralRiskDisclaimer(): string {
    return `
RISK WARNING: Copy trading involves significant risk of loss. Past performance is not indicative of future results.

Key Risks:
- You may lose all or part of your invested capital
- Copied traders may use strategies that don't align with your risk tolerance
- Market conditions can change rapidly
- Slippage and execution delays may affect results
- Fees and commissions will reduce your returns

Important Notes:
- Only invest what you can afford to lose
- Diversify across multiple traders
- Monitor your copy trading positions regularly
- Set appropriate stop-loss limits
- Understand the trader's strategy before copying

By proceeding, you acknowledge that you understand these risks and accept full responsibility for your trading decisions.
    `.trim();
  }

  /**
   * Get copy trading disclaimer
   */
  getCopyTradingDisclaimer(): string {
    return `
Copy Trading Disclaimer:

1. Performance Disclosure: Past performance does not guarantee future results. The performance shown is historical and may not reflect current market conditions.

2. Risk of Loss: Copy trading carries a high level of risk and may not be suitable for all investors. You could lose some or all of your invested capital.

3. No Guarantee: There is no guarantee that copying a trader will result in profits. Market conditions, execution timing, and other factors can affect results.

4. Independent Decision: You are solely responsible for your copy trading decisions. We do not provide investment advice.

5. Monitoring Required: You must actively monitor your copy trading positions and adjust settings as needed.

6. Trader Changes: Copied traders may change their strategies at any time without notice.

7. Execution Differences: Your trades may execute at different prices than the trader you're copying due to market conditions and timing.

8. Fees Apply: Copy trading may incur additional fees that will reduce your returns.
    `.trim();
  }

  /**
   * Sanitize trader profile for public view
   */
  sanitizeProfileForPublic(trader: TraderProfile): Partial<TraderProfile> {
    return {
      userId: trader.userId,
      username: trader.username,
      displayName: trader.displayName,
      avatarUrl: trader.avatarUrl,
      verified: trader.verified,
      bio: trader.bio,
      stats: {
        ...trader.stats,
        // Don't expose exact follower/copier counts for privacy
        followers: Math.floor(trader.stats.followers / 10) * 10,
        copiers: Math.floor(trader.stats.copiers / 10) * 10,
      },
      riskLevel: trader.riskLevel,
      tradingStyle: trader.tradingStyle,
      preferredMarkets: trader.preferredMarkets,
      joinedAt: trader.joinedAt,
    };
  }

  /**
   * Validate visibility level change
   */
  validateVisibilityChange(
    currentVisibility: VisibilityLevel,
    newVisibility: VisibilityLevel,
    hasCopiers: boolean
  ): { valid: boolean; reason?: string } {
    // Can't go private if you have active copiers
    if (newVisibility === 'private' && hasCopiers) {
      return {
        valid: false,
        reason: 'Cannot set profile to private while you have active copiers',
      };
    }

    return { valid: true };
  }
}
