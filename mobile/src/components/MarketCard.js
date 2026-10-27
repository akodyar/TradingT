import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function MarketCard({ market = {} }) {
  const price = Number(market.price || 0);
  const change = Number(market.change_percent_24h || 0);
  const isUp = change >= 0;
  const high = Number(market.high_24h || 0);
  const low = Number(market.low_24h || 0);
  const sparkline = market.sparkline || [];

  // Calculate sparkline bars
  const minVal = sparkline.length ? Math.min(...sparkline) : 0;
  const maxVal = sparkline.length ? Math.max(...sparkline) : 1;
  const range = maxVal - minVal || 1;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <View style={styles.symbolRow}>
              <Text style={styles.symbol}>{market.symbol || 'BTCUSDT'}</Text>
              <View style={[styles.badge, { backgroundColor: isUp ? COLORS.successGlow : COLORS.dangerGlow }]}>
                <Ionicons
                  name={isUp ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={isUp ? COLORS.success : COLORS.danger}
                />
                <Text style={[styles.badgeText, { color: isUp ? COLORS.success : COLORS.danger }]}>
                  {isUp ? '+' : ''}{change.toFixed(2)}%
                </Text>
              </View>
            </View>
            <Text style={styles.marketName}>Bitcoin / TetherUS Spot</Text>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>
              ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={styles.priceCurrency}>Live Price</Text>
          </View>
        </View>

        {/* Lightweight Sparkline visual */}
        {sparkline.length > 0 && (
          <View style={styles.chartContainer}>
            <View style={styles.sparklineRow}>
              {sparkline.map((val, idx) => {
                const heightPercent = Math.max(15, Math.min(100, ((val - minVal) / range) * 100));
                return (
                  <View key={idx} style={styles.barWrapper}>
                    <View
                      style={[
                        styles.sparklineBar,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: isUp ? COLORS.success : COLORS.danger,
                          opacity: 0.3 + (idx / sparkline.length) * 0.7,
                        }
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <View style={styles.chartLabels}>
              <Text style={styles.chartLabel}>24h Low: ${low.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
              <Text style={styles.chartLabel}>24h High: ${high.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  marketName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  priceCurrency: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chartContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 38,
    gap: 3,
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  sparklineBar: {
    width: '100%',
    borderRadius: 2,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  chartLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
