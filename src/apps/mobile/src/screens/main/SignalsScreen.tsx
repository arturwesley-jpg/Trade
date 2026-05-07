import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import { fetchSignals } from '@store/slices/signalsSlice';
import { wsService } from '@services/websocket-service';
import type { Signal } from '@/types';

export const SignalsScreen: React.FC = () => {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const { signals, isLoading } = useAppSelector((state) => state.signals);

  useEffect(() => {
    loadData();
    setupWebSocket();

    return () => {
      wsService.unsubscribe('signals');
    };
  }, []);

  const loadData = () => {
    dispatch(fetchSignals({ limit: 50 }));
  };

  const setupWebSocket = async () => {
    try {
      if (!wsService.isConnected()) {
        await wsService.connect();
      }

      wsService.subscribe('signals', (data: Signal) => {
        console.log('New signal:', data);
        // Signal will be added via Redux action
      });
    } catch (error) {
      console.error('WebSocket setup failed:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderItem = ({ item }: { item: Signal }) => (
    <TouchableOpacity
      style={[styles.signalCard, { backgroundColor: colors.card }]}
    >
      <View style={styles.signalHeader}>
        <View style={styles.signalTitleRow}>
          <Text style={[styles.symbol, { color: colors.text }]}>{item.symbol}</Text>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === 'BUY'
                    ? `${colors.buy}20`
                    : `${colors.sell}20`,
              },
            ]}
          >
            <Ionicons
              name={item.type === 'BUY' ? 'arrow-up' : 'arrow-down'}
              size={14}
              color={item.type === 'BUY' ? colors.buy : colors.sell}
            />
            <Text
              style={[
                styles.typeText,
                { color: item.type === 'BUY' ? colors.buy : colors.sell },
              ]}
            >
              {item.type}
            </Text>
          </View>
        </View>
        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
          {formatDate(item.timestamp)}
        </Text>
      </View>

      <View style={styles.signalDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Price
          </Text>
          <Text style={[styles.detailValue, { color: colors.text }]}>
            ${item.price.toFixed(2)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
            Confidence
          </Text>
          <View style={styles.confidenceContainer}>
            <View
              style={[
                styles.confidenceBar,
                { backgroundColor: colors.surface },
              ]}
            >
              <View
                style={[
                  styles.confidenceFill,
                  {
                    width: `${item.confidence * 100}%`,
                    backgroundColor:
                      item.confidence >= 0.7
                        ? colors.success
                        : item.confidence >= 0.5
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              />
            </View>
            <Text style={[styles.confidenceText, { color: colors.text }]}>
              {(item.confidence * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {item.indicators && item.indicators.length > 0 && (
          <View style={styles.indicatorsContainer}>
            {item.indicators.map((indicator, index) => (
              <View
                key={index}
                style={[
                  styles.indicatorBadge,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.indicatorText, { color: colors.text }]}>
                  {indicator}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'active'
                  ? `${colors.info}20`
                  : item.status === 'executed'
                  ? `${colors.success}20`
                  : `${colors.textSecondary}20`,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  item.status === 'active'
                    ? colors.info
                    : item.status === 'executed'
                    ? colors.success
                    : colors.textSecondary,
              },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={signals}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="flash-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No signals yet
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  signalCard: {
    borderRadius: 12,
    padding: 16,
  },
  signalHeader: {
    marginBottom: 12,
  },
  signalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  symbol: {
    fontSize: 20,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 14,
  },
  signalDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confidenceBar: {
    width: 100,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: '600',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indicatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
