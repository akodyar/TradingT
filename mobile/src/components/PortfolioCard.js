import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function PortfolioCard({
  totalValue,
  changePercent,
  hideBalance,
  onToggleHide,
  balances = []
}) {
  const formattedTotal = Number(totalValue || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const isPositive = Number(changePercent || 0) >= 0;

  // Calculate asset distribution %
  const usdtAsset = balances.find(b => b.asset === 'USDT');
  const btcAsset = balances.find(b => b.asset === 'BTC');

  const usdtVal = usdtAsset ? Number(usdtAsset.value_usdt || usdtAsset.total || 0) : 0;
  const btcVal = btcAsset ? Number(btcAsset.value_usdt || 0) : 0;
  const totalCalc = (usdtVal + btcVal) || 1;

  const btcPercent = Math.min(100, Math.max(0, (btcVal / totalCalc) * 100));
  const usdtPercent = Math.min(100, Math.max(0, 100 - btcPercent));

  return (
    <View style={styles.cardContainer}>
      <View style={styles.topRow}>
        <Text style={styles.label}>ESTIMATED TOTAL BALANCE</Text>
        <TouchableOpacity
          onPress={onToggleHide}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.eyeButton}
        >
          <Ionicons
            name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.currencySymbol}>$</Text>
        <Text style={styles.totalValue}>
          {hideBalance ? '••••••••' : formattedTotal}
        </Text>
        <Text style={styles.quoteCurrency}>USDT</Text>
      </View>

      <View style={styles.changeBadgeRow}>
        <View style={[
          styles.changeBadge,
          { backgroundColor: isPositive ? COLORS.successGlow : COLORS.dangerGlow }
        ]}>
          <Ionicons
            name={isPositive ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={isPositive ? COLORS.success : COLORS.danger}
          />
          <Text style={[
            styles.changeText,
            { color: isPositive ? COLORS.success : COLORS.danger }
          ]}>
            {Math.abs(Number(changePercent || 0)).toFixed(2)}% (24h)
          </Text>
        </View>

        <Text style={styles.pnlSubtext}>Spot Portfolio</Text>
      </View>

      {/* Asset Distribution Bar */}
      <View style={styles.distributionSection}>
        <View style={styles.distLabelRow}>
          <Text style={styles.distTitle}>Portfolio Allocation</Text>
          <Text style={styles.distSubtitle}>
            BTC {btcPercent.toFixed(1)}% • USDT {usdtPercent.toFixed(1)}%
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressBtc, { width: `${btcPercent}%` }]} />
          <View style={[styles.progressUsdt, { width: `${usdtPercent}%` }]} />
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.btc }]} />
            <Text style={styles.legendText}>
              BTC: {hideBalance ? '••••' : `$${btcVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.usdt }]} />
            <Text style={styles.legendText}>
              USDT: {hideBalance ? '••••' : `$${usdtVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: COLORS.textMuted,
  },
  eyeButton: {
    padding: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 4,
  },
  currencySymbol: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  totalValue: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  quoteCurrency: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 8,
  },
  changeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    gap: 10,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pnlSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  distributionSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 14,
  },
  distLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  distSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cardBorder,
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressBtc: {
    backgroundColor: COLORS.btc,
    height: '100%',
  },
  progressUsdt: {
    backgroundColor: COLORS.usdt,
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
