import React from 'react';
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
import { STRATEGIES } from '../services/strategyEngine';
import { setStrategy } from '../services/tradingBotManager';

export default function StrategyModal({
  visible,
  onClose,
  currentStrategyId,
  allSignals = {},
  onSelectStrategy,
}) {
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

  const handleSelect = (strategyId) => {
    setStrategy(strategyId);
    if (onSelectStrategy) {
      onSelectStrategy(strategyId);
    }
    onClose();
  };

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
                  <Text style={styles.title}>Select Trading Strategy</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Choose the technical analysis model that generates automated signals and triggers on-chain trades.
              </Text>

              {/* Strategy Cards List */}
              <ScrollView showsVerticalScrollIndicator={false} style={styles.strategyList}>
                {Object.values(STRATEGIES).map((strat) => {
                  const isSelected = strat.id === currentStrategyId;
                  const signalObj = allSignals[strat.id] || { signal: 'HOLD', details: '' };
                  const badge = getSignalBadge(signalObj.signal);

                  return (
                    <TouchableOpacity
                      key={strat.id}
                      style={[
                        styles.strategyCard,
                        isSelected && styles.strategyCardSelected,
                      ]}
                      onPress={() => handleSelect(strat.id)}
                      activeOpacity={0.7}
                    >
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

                        {/* Live Signal Badge for this strategy */}
                        <View style={[styles.signalPill, { backgroundColor: badge.bg }]}>
                          <Ionicons name={badge.icon} size={12} color={badge.color} />
                          <Text style={[styles.signalText, { color: badge.color }]}>
                            {signalObj.signal}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.strategyDesc}>{strat.description}</Text>

                      {signalObj.details ? (
                        <View style={styles.detailsRow}>
                          <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} />
                          <Text style={styles.detailsText} numberOfLines={1}>
                            {signalObj.details}
                          </Text>
                        </View>
                      ) : null}

                      {/* Indicators Pills */}
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
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
    marginBottom: 6,
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
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
    marginBottom: 16,
  },
  strategyList: {
    marginVertical: 4,
  },
  strategyCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 14,
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
    fontSize: 14,
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
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '800',
  },
  strategyDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  detailsText: {
    fontSize: 10,
    color: COLORS.textMuted,
    flex: 1,
  },
  indicatorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indicatorPill: {
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  indicatorText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
