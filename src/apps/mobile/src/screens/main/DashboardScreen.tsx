import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { fetchPortfolio, fetchMetrics } from '@store/slices/portfolioSlice';
import { fetchMarketData } from '@store/slices/marketSlice';

export const DashboardScreen: React.FC = () => {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const { portfolio, metrics, isLoading } = useAppSelector((state) => state.portfolio);
  const { data: marketData } = useAppSelector((state) => state.market);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    dispatch(fetchPortfolio());
    dispatch(fetchMetrics());
    dispatch(fetchMarketData());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={loadData} />
      }
    >
      <View style={styles.content}>
        {/* Portfolio Summary */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
            Total Portfolio Value
          </Text>
          <Text style={[styles.portfolioValue, { color: colors.text }]}>
            {portfolio ? formatCurrency(portfolio.totalValue) : '$0.00'}
          </Text>
          {portfolio && (
            <View style={styles.pnlContainer}>
              <Text
                style={[
                  styles.pnlText,
                  { color: portfolio.totalPnL >= 0 ? colors.success : colors.error },
                ]}
              >
                {formatCurrency(portfolio.totalPnL)} (
                {formatPercent(portfolio.totalPnLPercent)})
              </Text>
            </View>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Positions
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {portfolio?.positions.length || 0}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              Win Rate
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {metrics?.winRate ? `${(metrics.winRate * 100).toFixed(1)}%` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Positions */}
        {portfolio && portfolio.positions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Positions
            </Text>
            {portfolio.positions.map((position, index) => (
              <View
                key={index}
                style={[
                  styles.positionItem,
                  { borderBottomColor: colors.border },
                  index === portfolio.positions.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.positionHeader}>
                  <Text style={[styles.positionSymbol, { color: colors.text }]}>
                    {position.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.positionPnl,
                      { color: position.pnl >= 0 ? colors.success : colors.error },
                    ]}
                  >
                    {formatPercent(position.pnlPercent)}
                  </Text>
                </View>
                <View style={styles.positionDetails}>
                  <Text style={[styles.positionText, { color: colors.textSecondary }]}>
                    {position.quantity} @ {formatCurrency(position.entryPrice)}
                  </Text>
                  <Text style={[styles.positionText, { color: colors.textSecondary }]}>
                    {formatCurrency(position.value)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Market Overview */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Market Overview
          </Text>
          {Object.values(marketData).slice(0, 5).map((market: any, index) => (
            <View
              key={market.symbol}
              style={[
                styles.marketItem,
                { borderBottomColor: colors.border },
                index === 4 && styles.lastItem,
              ]}
            >
              <View>
                <Text style={[styles.marketSymbol, { color: colors.text }]}>
                  {market.symbol}
                </Text>
                <Text style={[styles.marketPrice, { color: colors.textSecondary }]}>
                  {formatCurrency(market.price)}
                </Text>
              </View>
              <Text
                style={[
                  styles.marketChange,
                  {
                    color:
                      market.changePercent24h >= 0 ? colors.success : colors.error,
                  },
                ]}
              >
                {formatPercent(market.changePercent24h)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  portfolioValue: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  pnlContainer: {
    marginTop: 8,
  },
  pnlText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  positionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  positionSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  positionPnl: {
    fontSize: 16,
    fontWeight: '600',
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionText: {
    fontSize: 14,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  marketSymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  marketPrice: {
    fontSize: 14,
  },
  marketChange: {
    fontSize: 16,
    fontWeight: '600',
  },
});
