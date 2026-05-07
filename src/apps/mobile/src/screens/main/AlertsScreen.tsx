import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppDispatch, useAppSelector } from '@hooks/redux';
import {
  fetchAlerts,
  createAlert,
  deleteAlert,
  updateAlert,
} from '@store/slices/alertsSlice';
import type { Alert as AlertType } from '@/types';

export const AlertsScreen: React.FC = () => {
  const { colors } = useTheme();
  const dispatch = useAppDispatch();
  const { alerts, isLoading } = useAppSelector((state) => state.alerts);

  const [modalVisible, setModalVisible] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    dispatch(fetchAlerts());
  };

  const handleCreateAlert = async () => {
    if (!symbol || !targetPrice) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    try {
      await dispatch(
        createAlert({
          symbol: symbol.toUpperCase(),
          condition,
          targetPrice: price,
        })
      ).unwrap();

      setModalVisible(false);
      setSymbol('');
      setTargetPrice('');
      Alert.alert('Success', 'Alert created successfully');
    } catch (error: any) {
      Alert.alert('Error', error || 'Failed to create alert');
    }
  };

  const handleDeleteAlert = (id: string) => {
    Alert.alert('Delete Alert', 'Are you sure you want to delete this alert?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatch(deleteAlert(id)),
      },
    ]);
  };

  const handleToggleAlert = (id: string, isActive: boolean) => {
    dispatch(updateAlert({ id, data: { isActive: !isActive } }));
  };

  const renderItem = ({ item }: { item: AlertType }) => (
    <View style={[styles.alertCard, { backgroundColor: colors.card }]}>
      <View style={styles.alertHeader}>
        <View style={styles.alertTitleRow}>
          <Text style={[styles.symbol, { color: colors.text }]}>
            {item.symbol}
          </Text>
          <TouchableOpacity
            onPress={() => handleToggleAlert(item.id, item.isActive)}
          >
            <Ionicons
              name={item.isActive ? 'notifications' : 'notifications-off'}
              size={24}
              color={item.isActive ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.conditionRow}>
          <Text style={[styles.conditionText, { color: colors.textSecondary }]}>
            Alert when price is{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {item.condition}
            </Text>{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              ${item.targetPrice.toFixed(2)}
            </Text>
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Current Price:
          </Text>
          <Text style={[styles.currentPrice, { color: colors.text }]}>
            ${item.currentPrice.toFixed(2)}
          </Text>
        </View>

        {item.triggeredAt && (
          <View
            style={[
              styles.triggeredBadge,
              { backgroundColor: `${colors.success}20` },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.triggeredText, { color: colors.success }]}>
              Triggered
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: `${colors.error}20` }]}
        onPress={() => handleDeleteAlert(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
        <Text style={[styles.deleteText, { color: colors.error }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={alerts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="notifications-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No alerts yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Create an alert to get notified about price changes
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Alert
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Symbol
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="e.g., BTC-USDT"
                placeholderTextColor={colors.textSecondary}
                value={symbol}
                onChangeText={setSymbol}
                autoCapitalize="characters"
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Condition
              </Text>
              <View style={styles.conditionButtons}>
                <TouchableOpacity
                  style={[
                    styles.conditionButton,
                    {
                      backgroundColor:
                        condition === 'above' ? colors.primary : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('above')}
                >
                  <Text
                    style={[
                      styles.conditionButtonText,
                      {
                        color: condition === 'above' ? '#FFFFFF' : colors.text,
                      },
                    ]}
                  >
                    Above
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.conditionButton,
                    {
                      backgroundColor:
                        condition === 'below' ? colors.primary : colors.surface,
                    },
                  ]}
                  onPress={() => setCondition('below')}
                >
                  <Text
                    style={[
                      styles.conditionButtonText,
                      {
                        color: condition === 'below' ? '#FFFFFF' : colors.text,
                      },
                    ]}
                  >
                    Below
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                Target Price
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                value={targetPrice}
                onChangeText={setTargetPrice}
                keyboardType="decimal-pad"
              />

              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateAlert}
              >
                <Text style={styles.createButtonText}>Create Alert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  alertCard: {
    borderRadius: 12,
    padding: 16,
  },
  alertHeader: {
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  symbol: {
    fontSize: 20,
    fontWeight: '600',
  },
  conditionRow: {
    marginBottom: 8,
  },
  conditionText: {
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  triggeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  triggeredText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  conditionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  conditionButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conditionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
