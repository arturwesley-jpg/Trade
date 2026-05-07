import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { fetchMarketData } from '@store/slices/marketSlice';
import { wsService } from '@services/websocket-service';
import type { MarketData } from '@/types';

export const MarketScreen: React.FC = () => {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const { data: marketData, watchlist, isLoading } = useAppSelector(
    (state) => state.market
  );
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    setupWebSocket();

    return () => {
      watchlist.forEach((symbol) => {
        wsService.unsubscribe(`market:${symbol}`);
      });
    };
  }, []);

  const loadData = () => {
    dispatch(fetchMarketData(watchlist));
  };

  const setupWebSocket = async () => {
    try {
      if (!wsService.isConnected()) {
        await wsService.connect();
      }

      watchlist.forEach((symbol) => {
        wsService.subscribe(`market:${symbol}`, (data: MarketData) => {
          // Update market data in real-time
          console.log('Market update:', data);
        });
      });
    } catch (error) {
      console.error('WebSocket setup failed:', error);
    }
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

  const filteredData = Object.values(marketData).filter((item: any) =>
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: MarketData }) => (
    <TouchableOpacity
      style={[styles.marketItem, { backgroundColor: colors.card }]}
    >
      <View style={styles.marketInfo}>
        <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
        <Text style={[styles.volume, { color: colors.textSecondary }]}>
          Vol: {(item.volume24h / 1000000).toFixed(2)}M
        </Text>
      </View>

      <View style={styles.marketPricing}>
        <Text style={[styles.price, { color: colors.text }]}>
          {formatCurrency(item.price)}
        </Text>
        <View
          style={[
            styles.changeContainer,
            {
              backgroundColor:
                item.changePercent24h >= 0
                  ? `${colors.success}20`
                  : `${colors.error}20`,
            },
          ]}
        >
          <Ionicons
            name={item.changePercent24h >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={item.changePercent24h >= 0 ? colors.success : colors.error}
          />
          <Text
            style={[
              styles.change,
              { color: item.changePercent24h >= 0 ? colors.success : colors.error },
            ]}
          >
            {formatPercent(item.changePercent24h)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search markets..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  marketItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  marketInfo: {
    flex: 1,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  volume: {
    fontSize: 14,
  },
  marketPricing: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
});
