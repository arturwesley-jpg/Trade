import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PriceChangeProps {
  value: number;
  showSign?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const PriceChange: React.FC<PriceChangeProps> = ({
  value,
  showSign = true,
  size = 'medium',
}) => {
  const { colors } = useTheme();

  const isPositive = value >= 0;
  const color = isPositive ? colors.success : colors.error;

  const fontSize = size === 'small' ? 12 : size === 'medium' ? 14 : 16;

  return (
    <Text style={[styles.text, { color, fontSize, fontWeight: '600' }]}>
      {showSign && isPositive && '+'}
      {value.toFixed(2)}%
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});
