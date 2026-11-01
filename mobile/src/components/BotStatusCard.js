import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { STRATEGIES } from '../services/strategyEngine';

export default function BotStatusCard({ bot = {}, onChangeStrategy }) {
  const signal = bot.current_signal || 'HOLD';
  const strategyName = bot.strategy_name || 'Dual Moving Average (20/50)';
  const strategyType = bot.strategy_type || 'Trend Following';
  const signalDetails = bot.signal_details || 'Evaluating live candle patterns...';
  const currentStrat = STRATEGIES[bot.strategy_id] || STRATEGIES.DUAL_MA;

  const getSignalStyle = (sig) => {
    switch (sig) {
      case 'BUY':
        return {
          bg: COLORS.successGlow,
          border: 'rgba(16, 185, 129, 0.4)',
          color: COLORS.success,
          icon: 'arrow-up-circle-outline',
          text: 'BUY SIGNAL',
        };
      case 'SELL':
        return {
          bg: COLORS.dangerGlow,
          border: 'rgba(239, 68, 68, 0.4)',
          color: COLORS.danger,
          icon: 'arrow-down-circle-outline',
          text: 'SELL SIGNAL',
        };
      default:
        return {
          bg: COLORS.warningGlow,
          border: 'rgba(245, 158, 11, 0.4)',
          color: COLORS.warning,
          icon: 'pause-circle-outline',
          text: 'HOLD / NEUTRAL',
        };
    }
  };

  const sigStyle = getSignalStyle(signal);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="hardware-chip-outline" size={17} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>ALGORITHMIC STRATEGY</Text>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={onChangeStrategy}
          activeOpacity={0.7}
        >
          <Ionicons name="git-branch-outline" size={13} color={COLORS.primary} />
          <Text style={styles.switchButtonText}>Change Strategy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {/* Strategy Title & Switch Banner */}
        <View style={styles.stratHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.stratNameText}>{strategyName}</Text>
            <View style={styles.stratMetaRow}>
              <Text style={styles.stratTypeText}>{strategyType}</Text>
              {currentStrat?.riskBadge ? (
                <View style={styles.riskBadgePill}>
                  <Text style={styles.riskBadgeText}>{currentStrat.riskBadge}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.changePill}
            onPress={onChangeStrategy}
            activeOpacity={0.7}
          >
            <Text style={styles.changePillText}>Change</Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Signal Banner */}
        <View style={[styles.signalBanner, { backgroundColor: sigStyle.bg, borderColor: sigStyle.border }]}>
          <View style={styles.signalLeft}>
            <Ionicons name={sigStyle.icon} size={22} color={sigStyle.color} />
            <View style={styles.signalTextContainer}>
              <Text style={[styles.signalStatus, { color: sigStyle.color }]}>{sigStyle.text}</Text>
              <Text style={styles.signalDesc} numberOfLines={2}>
                {signalDetails}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.candlePill}
            onPress={onChangeStrategy}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={11} color={COLORS.primary} style={{ marginRight: 3 }} />
            <Text style={styles.candleText}>{bot.interval || '1h'}</Text>
            <Ionicons name="swap-horizontal" size={10} color={COLORS.primary} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        {/* Bot Parameters */}
        <View style={styles.grid}>
          <View style={styles.paramBox}>
            <Text style={styles.paramLabel}>PAIR</Text>
            <Text style={styles.paramValue}>{bot.symbol || 'BTCUSDT'}</Text>
          </View>

          <View style={styles.paramBox}>
            <Text style={styles.paramLabel}>ORDER SIZE</Text>
            <Text style={styles.paramValue}>${bot.quote_order_size || '20'} USDT</Text>
          </View>

          <View style={styles.paramBox}>
            <Text style={styles.paramLabel}>STATUS</Text>
            <View style={styles.statusInnerRow}>
              <View style={[styles.miniDot, { backgroundColor: bot.status === 'RUNNING' ? COLORS.success : COLORS.warning }]} />
              <Text style={[styles.paramValue, { color: bot.status === 'RUNNING' ? COLORS.success : COLORS.warning }]}>
                {bot.status || 'ACTIVE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer timestamp */}
        <View style={styles.footerRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
          <Text style={styles.footerTime}>
            Candle: {bot.last_candle_time || 'Syncing...'}
            {bot.last_bg_tick ? ` · 24/7 Tick: ${bot.last_bg_tick} (#${bot.bg_tick_count || 1})` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  switchButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stratHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  stratNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  stratTypeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  stratMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  riskBadgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.success,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  changePillText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
  },
  signalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  signalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  signalTextContainer: {
    flex: 1,
  },
  signalStatus: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  signalDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  candlePill: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  candleText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paramBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 10,
  },
  paramLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  paramValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  footerTime: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
