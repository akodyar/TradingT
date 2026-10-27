import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { executeManualBuy, executeManualSell } from '../services/tradingBotManager';

export default function PositionsSection({
  positions = [],
  currentPrice,
  hideBalance,
  onTradeSuccess,
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'
  const [buyAmount, setBuyAmount] = useState('20');
  const [sellPercent, setSellPercent] = useState('50');
  const [isExecuting, setIsExecuting] = useState(false);

  const formattedPrice = Number(currentPrice || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const buyPos = positions.find((p) => p.side === 'BUY' || p.asset === 'USDT') || {};
  const sellPos = positions.find((p) => p.side === 'SELL' || p.asset === 'BTC' || p.id === 'spot_holding') || {};

  const availableCash = buyPos.availableCash !== undefined
    ? Number(buyPos.availableCash)
    : Number(buyPos.value_usdt || buyPos.quantity || 0);

  const sellQty = Number(sellPos.quantity !== undefined ? sellPos.quantity : 0);
  const sellValueUsdt = sellPos.value_usdt !== undefined
    ? Number(sellPos.value_usdt)
    : sellQty * Number(currentPrice || 0);

  const maxPurchasable = Number(currentPrice || 0) > 0 ? availableCash / Number(currentPrice) : 0;

  const handleBuy = async () => {
    const amount = parseFloat(buyAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid USDT amount to buy.');
      return;
    }
    if (amount > (buyPos.availableCash || 0)) {
      Alert.alert('Insufficient Balance', 'You do not have enough USDT.');
      return;
    }

    setIsExecuting(true);
    try {
      const res = await executeManualBuy(amount);
      setIsExecuting(false);
      Alert.alert(
        'Market Buy Executed',
        `Bought ${res.executedQty || 'BTC'} for $${amount} USDT.\nOrder ID: ${res.orderId || 'OK'}`
      );
      if (onTradeSuccess) onTradeSuccess();
    } catch (err) {
      setIsExecuting(false);
      Alert.alert('Buy Order Failed', err.message || 'Error executing order');
    }
  };

  const handleSell = async () => {
    const totalBtc = sellPos.quantity || 0;
    if (totalBtc <= 0) {
      Alert.alert('No Position', 'You have no BTC to sell.');
      return;
    }

    const pct = parseFloat(sellPercent) / 100;
    const sellQty = totalBtc * pct;

    setIsExecuting(true);
    try {
      const res = await executeManualSell(sellQty);
      setIsExecuting(false);
      Alert.alert(
        'Market Sell Executed',
        `Sold ${res.executedQty || sellQty} BTC.\nOrder ID: ${res.orderId || 'OK'}`
      );
      if (onTradeSuccess) onTradeSuccess();
    } catch (err) {
      setIsExecuting(false);
      Alert.alert('Sell Order Failed', err.message || 'Error executing order');
    }
  };

  const showBuy = activeTab === 'ALL' || activeTab === 'BUY';
  const showSell = activeTab === 'ALL' || activeTab === 'SELL';

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>POSITIONS & EXECUTION</Text>
        </View>
        <Text style={styles.headerSub}>BUY & SELL SIDES</Text>
      </View>

      {/* Side Selector Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ALL' && styles.tabActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            BOTH SIDES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'BUY' && styles.tabActiveBuy]}
          onPress={() => setActiveTab('BUY')}
        >
          <View style={[styles.tabDot, { backgroundColor: COLORS.success }]} />
          <Text style={[styles.tabText, activeTab === 'BUY' && { color: COLORS.success }]}>
            BUY SIDE (USDT)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'SELL' && styles.tabActiveSell]}
          onPress={() => setActiveTab('SELL')}
        >
          <View style={[styles.tabDot, { backgroundColor: COLORS.danger }]} />
          <Text style={[styles.tabText, activeTab === 'SELL' && { color: COLORS.danger }]}>
            SELL SIDE (BTC)
          </Text>
        </TouchableOpacity>
      </View>

      {/* ---------------- BUY SIDE CARD ---------------- */}
      {showBuy && (
        <View style={styles.sideCard}>
          <View style={styles.cardHeader}>
            <View style={styles.sideIconRow}>
              <View style={[styles.badgeIcon, { backgroundColor: COLORS.successGlow }]}>
                <Ionicons name="arrow-up-circle" size={20} color={COLORS.success} />
              </View>
              <View>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.sideTitle}>BUY POSITION (LONG)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: COLORS.successGlow }]}>
                    <Text style={[styles.pillText, { color: COLORS.success }]}>READY TO BUY</Text>
                  </View>
                </View>
                <Text style={styles.sideSub}>Available Cash to Buy BTC</Text>
              </View>
            </View>
          </View>

          {/* Metrics */}
          <View style={styles.metricsBox}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>BUYING POWER</Text>
              <Text style={[styles.metricValue, { color: COLORS.success }]}>
                {hideBalance
                  ? '••••••'
                  : `$${availableCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </Text>
              <Text style={styles.metricSub}>USDT Balance</Text>
            </View>

            <View style={[styles.metricItem, styles.metricRight]}>
              <Text style={styles.metricLabel}>MAX PURCHASABLE</Text>
              <Text style={styles.metricValue}>
                {hideBalance
                  ? '••••••'
                  : `${maxPurchasable.toFixed(4)} BTC`}
              </Text>
              <Text style={styles.metricSub}>@ ${formattedPrice}</Text>
            </View>
          </View>

          {/* Quick Buy Execution Control */}
          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>QUICK BUY AMOUNT (USDT)</Text>
            <View style={styles.chipsRow}>
              {['20', '50', '100', '250'].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, buyAmount === val && styles.chipActiveBuy]}
                  onPress={() => setBuyAmount(val)}
                >
                  <Text style={[styles.chipText, buyAmount === val && styles.chipTextActive]}>
                    ${val}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, buyAmount === String(Math.floor(availableCash || 0)) && styles.chipActiveBuy]}
                onPress={() => setBuyAmount(String(Math.floor(availableCash || 0)))}
              >
                <Text style={styles.chipText}>MAX</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  style={styles.textInput}
                  value={buyAmount}
                  onChangeText={setBuyAmount}
                  keyboardType="numeric"
                  placeholder="20"
                  placeholderTextColor={COLORS.textDim}
                />
                <Text style={styles.inputSuffix}>USDT</Text>
              </View>

              <TouchableOpacity
                style={[styles.tradeBtn, { backgroundColor: COLORS.success }]}
                onPress={handleBuy}
                disabled={isExecuting}
                activeOpacity={0.8}
              >
                {isExecuting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="arrow-up" size={15} color="#FFFFFF" />
                    <Text style={styles.tradeBtnText}>BUY BTC</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ---------------- SELL SIDE CARD ---------------- */}
      {showSell && (
        <View style={[styles.sideCard, { marginTop: showBuy ? 12 : 0 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.sideIconRow}>
              <View style={[styles.badgeIcon, { backgroundColor: COLORS.dangerGlow }]}>
                <Ionicons name="arrow-down-circle" size={20} color={COLORS.danger} />
              </View>
              <View>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.sideTitle}>SELL POSITION (INVENTORY)</Text>
                  <View style={[styles.pillBadge, { backgroundColor: COLORS.dangerGlow }]}>
                    <Text style={[styles.pillText, { color: COLORS.danger }]}>
                      {sellQty > 0 ? 'READY TO SELL' : 'NO HOLDINGS'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sideSub}>Active BTC Position to Sell</Text>
              </View>
            </View>
          </View>

          {/* Metrics */}
          <View style={styles.metricsBox}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>SELLABLE INVENTORY</Text>
              <Text style={[styles.metricValue, { color: COLORS.btc }]}>
                {hideBalance ? '••••••' : `${sellQty.toFixed(4)} BTC`}
              </Text>
              <Text style={styles.metricSub}>Spot Balance</Text>
            </View>

            <View style={[styles.metricItem, styles.metricRight]}>
              <Text style={styles.metricLabel}>ESTIMATED VALUE</Text>
              <Text style={styles.metricValue}>
                {hideBalance
                  ? '••••••'
                  : `$${sellValueUsdt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </Text>
              <Text style={styles.metricSub}>@ ${formattedPrice}</Text>
            </View>
          </View>

          {/* Quick Sell Execution Control */}
          <View style={styles.actionSection}>
            <Text style={styles.actionLabel}>QUICK SELL PROPORTION</Text>
            <View style={styles.chipsRow}>
              {['25', '50', '75', '100'].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={[styles.chip, sellPercent === pct && styles.chipActiveSell]}
                  onPress={() => setSellPercent(pct)}
                >
                  <Text style={[styles.chipText, sellPercent === pct && styles.chipTextActive]}>
                    {pct}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionRow}>
              <View style={styles.sellQtyPreview}>
                <Text style={styles.sellCalcLabel}>Will Sell:</Text>
                <Text style={styles.sellCalcValue}>
                  {((Number(sellPos.quantity || 0) * parseFloat(sellPercent)) / 100).toFixed(4)} BTC
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.tradeBtn, { backgroundColor: COLORS.danger }]}
                onPress={handleSell}
                disabled={isExecuting || Number(sellPos.quantity || 0) <= 0}
                activeOpacity={0.8}
              >
                {isExecuting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="arrow-down" size={15} color="#FFFFFF" />
                    <Text style={styles.tradeBtnText}>SELL BTC</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
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
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    gap: 5,
  },
  tabActive: {
    backgroundColor: COLORS.cardElevated,
  },
  tabActiveBuy: {
    backgroundColor: COLORS.successGlow,
  },
  tabActiveSell: {
    backgroundColor: COLORS.dangerGlow,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
  },
  sideCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    marginBottom: 12,
  },
  sideIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sideSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  metricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  metricSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 12,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chipActiveBuy: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  chipActiveSell: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    height: 42,
  },
  inputPrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  inputSuffix: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  sellQtyPreview: {
    flex: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    height: 42,
    justifyContent: 'center',
  },
  sellCalcLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  sellCalcValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 10,
    gap: 6,
  },
  tradeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
