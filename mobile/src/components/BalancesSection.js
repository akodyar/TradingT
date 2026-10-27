import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function BalancesSection({ balances = [], totalPortfolioValue, hideBalance }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllDust, setShowAllDust] = useState(false);

  // STRICT FILTER: Zero balance coins are completely excluded
  const nonZeroBalances = balances.filter((item) => {
    const total = parseFloat(item.total_raw || item.total || '0');
    return total > 0.00000001;
  });

  // Meaningful active balances (> $0.10 USD value or primary crypto assets)
  const meaningfulBalances = nonZeroBalances.filter((item) => {
    const val = Number(item.value_usdt || 0);
    const isMajor = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL'].includes(item.asset);
    return val >= 0.1 || isMajor;
  });

  const displayedList = (showAllDust ? nonZeroBalances : meaningfulBalances).filter(
    (item) => item.asset.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAssetDetails = (asset) => {
    switch (asset) {
      case 'BTC':
        return {
          name: 'Bitcoin',
          color: COLORS.btc,
          icon: 'logo-bitcoin',
        };
      case 'USDT':
        return {
          name: 'Tether USD',
          color: COLORS.usdt,
          icon: 'cash-outline',
        };
      case 'ETH':
        return {
          name: 'Ethereum',
          color: COLORS.eth,
          icon: 'logo-usd',
        };
      case 'BNB':
        return {
          name: 'BNB',
          color: '#F3BA2F',
          icon: 'cube-outline',
        };
      case 'SOL':
        return {
          name: 'Solana',
          color: '#14F195',
          icon: 'flash-outline',
        };
      default:
        return {
          name: asset,
          color: COLORS.primary,
          icon: 'ellipse-outline',
        };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="wallet-outline" size={17} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>ASSET BALANCES</Text>
        </View>
        <View style={styles.assetBadge}>
          <Text style={styles.assetCountText}>
            {displayedList.length} Active {displayedList.length === 1 ? 'Coin' : 'Coins'}
          </Text>
        </View>
      </View>

      {/* Optional Search / Filter bar if more than 4 assets */}
      {nonZeroBalances.length > 3 && (
        <View style={styles.filterRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={14} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search coin..."
              placeholderTextColor={COLORS.textDim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.dustToggle, showAllDust && styles.dustToggleActive]}
            onPress={() => setShowAllDust(!showAllDust)}
          >
            <Text style={[styles.dustToggleText, showAllDust && { color: COLORS.primary }]}>
              {showAllDust ? 'Show Main' : 'Show All'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Balance Cards */}
      {displayedList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={28} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No matching positive balances</Text>
        </View>
      ) : (
        displayedList.map((item) => {
          const details = getAssetDetails(item.asset);
          const itemVal = Number(item.value_usdt || 0);
          const portVal = Number(totalPortfolioValue || 1);
          const sharePercent = Math.min(100, Math.max(0, (itemVal / portVal) * 100));

          return (
            <View key={item.asset} style={styles.balanceCard}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.leftInfo}>
                  <View style={[styles.coinIcon, { backgroundColor: `${details.color}20` }]}>
                    <Ionicons name={details.icon} size={20} color={details.color} />
                  </View>
                  <View>
                    <View style={styles.symbolRow}>
                      <Text style={styles.symbolText}>{item.asset}</Text>
                      {sharePercent > 0.05 && (
                        <View style={styles.shareBadge}>
                          <Text style={styles.shareText}>{sharePercent.toFixed(1)}%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.nameText}>{details.name}</Text>
                  </View>
                </View>

                <View style={styles.rightValuation}>
                  <Text style={styles.totalUsdText}>
                    {hideBalance
                      ? '••••••'
                      : `$${itemVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </Text>
                  <Text style={styles.totalTokenText}>
                    {hideBalance ? '••••' : `${item.total} ${item.asset}`}
                  </Text>
                </View>
              </View>

              {/* Free vs Locked */}
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>AVAILABLE (FREE)</Text>
                  <Text style={[styles.breakdownValue, { color: COLORS.success }]}>
                    {hideBalance ? '••••' : item.free}
                  </Text>
                </View>

                <View style={styles.breakdownDivider} />

                <View style={styles.breakdownItem}>
                  <Text style={styles.breakdownLabel}>IN ORDERS (LOCKED)</Text>
                  <Text
                    style={[
                      styles.breakdownValue,
                      { color: Number(item.locked) > 0 ? COLORS.warning : COLORS.textMuted },
                    ]}
                  >
                    {hideBalance ? '••••' : item.locked}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
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
  assetBadge: {
    backgroundColor: COLORS.cardElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  assetCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  dustToggle: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dustToggleActive: {
    borderColor: COLORS.primary,
  },
  dustToggleText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symbolText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  shareBadge: {
    backgroundColor: COLORS.cardBorder,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  shareText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  nameText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  rightValuation: {
    alignItems: 'flex-end',
  },
  totalUsdText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  totalTokenText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  breakdownItem: {
    flex: 1,
  },
  breakdownDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 10,
  },
  breakdownLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
