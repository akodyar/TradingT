import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  STRATEGIES,
  CANDLE_INTERVALS,
  MINIMUM_RISK_CONFIG,
} from '../services/strategyEngine';
import {
  setStrategyAndInterval,
  setCandleInterval,
  applyMinimumRiskConfiguration,
} from '../services/tradingBotManager';

export default function StrategyModal({
  visible,
  onClose,
  currentStrategyId = 'DUAL_MA',
  currentInterval = '1m',
  allSignals = {},
  onSelectStrategy,
}) {
  const [selectedInterval, setSelectedInterval] = useState(currentInterval);
  const [selectedStrategyId, setSelectedStrategyId] = useState(currentStrategyId);
  const [riskFilter, setRiskFilter] = useState('ALL');

  useEffect(() => {
    if (visible) {
      setSelectedInterval(currentInterval || '1m');
      setSelectedStrategyId(currentStrategyId || 'DUAL_MA');
      setRiskFilter('ALL');
    }
  }, [visible, currentInterval, currentStrategyId]);

  const getSignalBadge = (signal) => {
    switch (signal) {
      case 'BUY':
        return { bg: COLORS.successGlow, color: COLORS.success, icon: 'arrow-up-circle' };
      case 'SELL':
        return { bg: COLORS.dangerGlow, color: COLORS.danger, icon: 'arrow-down-circle' };
      default:
        return { bg: COLORS.warningGlow, color: COLORS.warning, icon: 'pause-circle' };
    }
  };

  const getRiskBadgeColor = (riskLevel) => {
    switch (riskLevel) {
      case 'LOW':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: COLORS.success };
      case 'LOW-MEDIUM':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: COLORS.primary };
      case 'MEDIUM':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: COLORS.warning };
      case 'HIGH':
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: COLORS.danger };
    }
  };

  const handleIntervalChange = async (intervalId) => {
    setSelectedInterval(intervalId);
    await setCandleInterval(intervalId);
    if (onSelectStrategy) {
      onSelectStrategy(selectedStrategyId, intervalId);
    }
  };

  const handleSelectStrategy = async (strategyId) => {
    setSelectedStrategyId(strategyId);
    await setStrategyAndInterval(strategyId, selectedInterval);
    if (onSelectStrategy) {
      onSelectStrategy(strategyId, selectedInterval);
    }
    onClose();
  };

  const handleApplyMinimumRisk = async () => {
    await applyMinimumRiskConfiguration();
    setSelectedStrategyId('DUAL_MA');
    setSelectedInterval('1h');
    if (onSelectStrategy) {
      onSelectStrategy('DUAL_MA', '1h');
    }
    onClose();
  };

  const filteredStrategies = Object.values(STRATEGIES).filter((strat) => {
    if (riskFilter === 'ALL') return true;
    if (riskFilter === 'LOW') return strat.riskLevel === 'LOW' || strat.riskLevel === 'LOW-MEDIUM';
    if (riskFilter === 'MEDIUM') return strat.riskLevel === 'MEDIUM';
    if (riskFilter === 'HIGH') return strat.riskLevel === 'HIGH';
    return true;
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Ionicons name="git-branch-outline" size={19} color={COLORS.primary} />
                  <Text style={styles.title}>Strategy & Timeframe</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Select the candle interval and model best aligned with your risk tolerance.
              </Text>

              {/* ── 1. CANDLE INTERVAL SELECTOR ── */}
              <View style={styles.sectionBox}>
                <View style={styles.sectionLabelRow}>
                  <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.sectionLabel}>CANDLE TIMEFRAME / INTERVAL</Text>
                  <Text style={styles.activeIntervalLabel}>Active: {selectedInterval}</Text>
                </View>

                <View style={styles.intervalGrid}>
                  {CANDLE_INTERVALS.map((intv) => {
                    const isSelected = intv.id === selectedInterval;
                    return (
                      <TouchableOpacity
                        key={intv.id}
                        style={[
                          styles.intervalChip,
                          isSelected && styles.intervalChipSelected,
                          intv.isBestLowRisk && !isSelected && styles.intervalChipRecommended,
                        ]}
                        onPress={() => handleIntervalChange(intv.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.intervalChipText,
                            isSelected && styles.intervalChipTextSelected,
                          ]}
                        >
                          {intv.label}
                        </Text>
                        <Text
                          style={[
                            styles.intervalSubText,
                            isSelected && styles.intervalSubTextSelected,
                          ]}
                        >
                          {intv.tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── 2. MINIMUM RISK RECOMMENDATION BANNER ── */}
              <View style={styles.minRiskBanner}>
                <View style={styles.minRiskHeader}>
                  <View style={styles.minRiskTitleRow}>
                    <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                    <Text style={styles.minRiskTitle}>Minimum Risk Recommendation</Text>
                  </View>
                  <View style={styles.safestTag}>
                    <Text style={styles.safestTagText}>SAFEST</Text>
                  </View>
                </View>

                <Text style={styles.minRiskDesc}>
                  {MINIMUM_RISK_CONFIG.reason}
                </Text>

                <TouchableOpacity
                  style={styles.applyMinRiskBtn}
                  onPress={handleApplyMinimumRisk}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.applyMinRiskBtnText}>
                    Apply Best Low-Risk Setup (Dual MA + 1h)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── 3. RISK FILTER TABS ── */}
              <View style={styles.filterRow}>
                {[
                  { id: 'ALL', label: 'All Models' },
                  { id: 'LOW', label: '🛡️ Low Risk' },
                  { id: 'MEDIUM', label: '⚖️ Medium' },
                  { id: 'HIGH', label: '⚡ Momentum' },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.filterTab,
                      riskFilter === f.id && styles.filterTabActive,
                    ]}
                    onPress={() => setRiskFilter(f.id)}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        riskFilter === f.id && styles.filterTabTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── 4. STRATEGIES LIST ── */}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.strategyList}>
                {filteredStrategies.map((strat) => {
                  const isSelected = strat.id === selectedStrategyId;
                  const signalObj = allSignals[strat.id] || { signal: 'HOLD', details: '' };
                  const badge = getSignalBadge(signalObj.signal);
                  const riskColors = getRiskBadgeColor(strat.riskLevel);

                  return (
                    <TouchableOpacity
                      key={strat.id}
                      style={[
                        styles.strategyCard,
                        isSelected && styles.strategyCardSelected,
                      ]}
                      onPress={() => handleSelectStrategy(strat.id)}
                      activeOpacity={0.7}
                    >
                      {/* Top Row: Name & Live Signal */}
                      <View style={styles.cardTop}>
                        <View style={styles.cardTitleInfo}>
                          <View style={styles.nameRow}>
                            <Text
                              style={[
                                styles.strategyName,
                                isSelected && { color: COLORS.primary },
                              ]}
                            >
                              {strat.name}
                            </Text>
                            {isSelected && (
                              <View style={styles.activeTag}>
                                <Text style={styles.activeTagText}>ACTIVE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.strategyType}>{strat.type}</Text>
                        </View>

                        {/* Live Signal Badge */}
                        <View style={[styles.signalPill, { backgroundColor: badge.bg }]}>
                          <Ionicons name={badge.icon} size={12} color={badge.color} />
                          <Text style={[styles.signalText, { color: badge.color }]}>
                            {signalObj.signal}
                          </Text>
                        </View>
                      </View>

                      {/* Risk Badge & Recommended Timeframe */}
                      <View style={styles.riskRow}>
                        <View
                          style={[
                            styles.riskBadge,
                            { backgroundColor: riskColors.bg, borderColor: riskColors.border },
                          ]}
                        >
                          <Text style={[styles.riskBadgeText, { color: riskColors.text }]}>
                            {strat.riskBadge || strat.riskLevel}
                          </Text>
                        </View>
                        <View style={styles.recIntervalPill}>
                          <Ionicons name="hourglass-outline" size={11} color={COLORS.textMuted} />
                          <Text style={styles.recIntervalText}>
                            Best on: {strat.recommendedInterval || '1h'}
                          </Text>
                        </View>
                      </View>

                      {/* Strategy Description */}
                      <Text style={styles.strategyDesc}>{strat.description}</Text>

                      {/* Risk Suitability Note */}
                      {strat.riskDescription ? (
                        <View style={styles.riskNoteRow}>
                          <Ionicons name="information-circle" size={12} color={riskColors.text} />
                          <Text style={styles.riskNoteText}>
                            {strat.riskDescription}
                          </Text>
                        </View>
                      ) : null}

                      {/* Live Indicator Signal Details */}
                      {signalObj.details ? (
                        <View style={styles.detailsRow}>
                          <Ionicons name="pulse-outline" size={12} color={COLORS.primary} />
                          <Text style={styles.detailsText} numberOfLines={1}>
                            {signalObj.details}
                          </Text>
                        </View>
                      ) : null}

                      {/* Indicator Pills */}
                      <View style={styles.indicatorsRow}>
                        {strat.indicators.map((ind, i) => (
                          <View key={i} style={styles.indicatorPill}>
                            <Text style={styles.indicatorText}>{ind}</Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalContent: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 15,
    marginBottom: 12,
  },

  // 1. Timeframe / Interval section
  sectionBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    flex: 1,
  },
  activeIntervalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  intervalGrid: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  intervalChip: {
    flex: 1,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  intervalChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  intervalChipRecommended: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  intervalChipTextSelected: {
    color: '#FFFFFF',
  },
  intervalSubText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  intervalSubTextSelected: {
    color: '#E0E7FF',
  },

  // 2. Minimum Risk Banner
  minRiskBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  minRiskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  minRiskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  minRiskTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.success,
  },
  safestTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  safestTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.success,
  },
  minRiskDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 14,
    marginBottom: 8,
  },
  applyMinRiskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 7,
  },
  applyMinRiskBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // 3. Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterTabActive: {
    backgroundColor: COLORS.cardElevated,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: COLORS.primary,
  },

  // 4. Strategy Cards List
  strategyList: {
    flexGrow: 0,
    maxHeight: 380,
  },
  strategyCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
  },
  strategyCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  cardTitleInfo: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  strategyName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  activeTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  strategyType: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  signalText: {
    fontSize: 10,
    fontWeight: '800',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  recIntervalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recIntervalText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  strategyDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
    marginBottom: 6,
  },
  riskNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  riskNoteText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 13,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
  },
  detailsText: {
    fontSize: 10,
    color: COLORS.textMuted,
    flex: 1,
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  indicatorPill: {
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  indicatorText: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
