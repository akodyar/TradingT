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
import { getBotState } from '../services/tradingBotManager';
import { loadBotStateFromStorage } from '../services/storageService';

export default function TradeHistoryModal({ visible, onClose }) {
  const botState = getBotState();
  const [trades, setTrades] = useState(botState.trades || []);

  useEffect(() => {
    if (visible) {
      loadBotStateFromStorage().then((state) => {
        if (state && state.trades) {
          setTrades(state.trades);
        }
      });
    }
  }, [visible]);

  const formatPrice = (p) =>
    Number(p || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Handle bar */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.title}>Trade History</Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.subtitle}>
                Autonomous trades executed in foreground & 24/7 background
              </Text>

              {trades.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No trades yet</Text>
                  <Text style={styles.emptyDesc}>
                    The bot will execute trades automatically when a strategy signal triggers.
                    You'll receive a push notification instantly.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  {trades.map((trade, idx) => {
                    const isBuy = trade.side === 'BUY';
                    return (
                      <View
                        key={`${trade.id || idx}`}
                        style={[
                          styles.tradeCard,
                          {
                            borderLeftColor: isBuy ? COLORS.success : COLORS.danger,
                          },
                        ]}
                      >
                        {/* Side badge */}
                        <View
                          style={[
                            styles.sideBadge,
                            {
                              backgroundColor: isBuy ? COLORS.successGlow : COLORS.dangerGlow,
                            },
                          ]}
                        >
                          <Ionicons
                            name={isBuy ? 'arrow-up' : 'arrow-down'}
                            size={14}
                            color={isBuy ? COLORS.success : COLORS.danger}
                          />
                          <Text
                            style={[
                              styles.sideText,
                              { color: isBuy ? COLORS.success : COLORS.danger },
                            ]}
                          >
                            {trade.side}
                          </Text>
                        </View>

                        {/* Details */}
                        <View style={styles.tradeInfo}>
                          <Text style={styles.tradeQty}>
                            {parseFloat(trade.qty || 0).toFixed(6)} BTC
                          </Text>
                          <Text style={styles.tradePrice}>
                            @ ${formatPrice(trade.price)}
                          </Text>
                        </View>

                        {/* Value + time */}
                        <View style={styles.tradeRight}>
                          <Text style={styles.tradeValue}>
                            ${formatPrice(
                              parseFloat(trade.qty || 0) * parseFloat(trade.price || 0)
                            )}
                          </Text>
                          <Text style={styles.tradeTime}>{trade.time || '--'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
  },
  list: {
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  tradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 10,
  },
  sideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sideText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tradeInfo: {
    flex: 1,
  },
  tradeQty: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tradePrice: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tradeRight: {
    alignItems: 'flex-end',
  },
  tradeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tradeTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
