import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  AppState,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { COLORS } from './src/constants/theme';
import {
  getDashboardOverview,
  getBotState,
  initBotManager,
} from './src/services/tradingBotManager.js';
import {
  requestNotificationPermissions,
} from './src/services/notificationService.js';
import {
  registerBackgroundTask,
  syncBackgroundState,
  isBackgroundTaskRegistered,
  runTradingEngineCycle,
} from './src/services/backgroundTask.js';

import Header from './src/components/Header';
import PortfolioCard from './src/components/PortfolioCard';
import PositionsSection from './src/components/PositionsSection';
import BalancesSection from './src/components/BalancesSection';
import MarketCard from './src/components/MarketCard';
import BotStatusCard from './src/components/BotStatusCard';
import SettingsModal from './src/components/SettingsModal';
import StrategyModal from './src/components/StrategyModal';
import TradeHistoryModal from './src/components/TradeHistoryModal';

export default function App() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [strategyModalVisible, setStrategyModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [bgTaskActive, setBgTaskActive] = useState(false);
  const [notifPermission, setNotifPermission] = useState(false);
  const [lastNotif, setLastNotif] = useState(null); // last trade notification received

  const pollTimerRef = useRef(null);
  const notifListenerRef = useRef(null);
  const notifResponseRef = useRef(null);

  // ── Setup: permissions + 24/7 background engine ──
  useEffect(() => {
    (async () => {
      // 0. Initialize persistent bot state from disk
      await initBotManager(true);

      // 1. Request notification permissions (non-blocking for background engine)
      const granted = await requestNotificationPermissions();
      setNotifPermission(granted);

      // 2. ALWAYS register 24/7 Foreground Service + continuous background loop
      const registered = await registerBackgroundTask();
      const alreadyOn = await isBackgroundTaskRegistered();
      setBgTaskActive(Boolean(registered || alreadyOn));

      // 3. Listen for notifications while app is in foreground
      notifListenerRef.current = Notifications.addNotificationReceivedListener(
        (notification) => {
          const { type, qty, price, symbol } = notification.request.content.data || {};
          if (type === 'BUY' || type === 'SELL') {
            setLastNotif({ type, qty, price, symbol, time: new Date().toLocaleTimeString() });
            // Refresh data to reflect executed trade
            loadData(false);
          }
        }
      );

      // 4. Listen for user tapping a notification
      notifResponseRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const { type } = response.notification.request.content.data || {};
          if (type === 'BUY' || type === 'SELL') {
            setHistoryModalVisible(true);
          }
        }
      );
    })();

    // 5. Refresh UI state immediately when user returns to app from background
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadData(false);
      }
    });

    return () => {
      notifListenerRef.current?.remove();
      notifResponseRef.current?.remove();
      appStateSub?.remove();
    };
  }, []);

  // ── Keep background task state in sync with credentials + strategy ──
  useEffect(() => {
    if (data) {
      const botState = getBotState();
      syncBackgroundState({
        credentials: botState.credentials,
        symbol: botState.symbol,
        interval: botState.interval,
        quoteOrderSize: botState.quoteOrderSize,
        strategyId: botState.currentStrategyId,
        position_qty: botState.position_qty,
        isEngineEnabled: botState.isEngineRunning,
      });
    }
  }, [data]);

  const loadData = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setIsRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const res = await getDashboardOverview();
      if (res && res.success) {
        setData(res);
        setIsConnected(true);
        setErrorMessage(null);
      } else {
        throw new Error('Could not parse Binance exchange data');
      }
    } catch (err) {
      console.warn('Binance Exchange Direct Error:', err.message);
      setIsConnected(false);
      setErrorMessage(err.message || 'Failed to connect directly to Binance');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic live refresh every 15 seconds while app is open
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      loadData(false);
    }, 15000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={COLORS.background} />

      <Header
        isConnected={isConnected}
        isRefreshing={isRefreshing}
        onRefresh={() => loadData(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      {/* Background task + notification status bar */}
      <View style={styles.statusStrip}>
        {/* BG Task indicator */}
        <TouchableOpacity
          style={styles.statusPill}
          onPress={async () => {
            const active = await registerBackgroundTask();
            setBgTaskActive(active);
            await runTradingEngineCycle('manual');
            loadData(false);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.statusDot, { backgroundColor: bgTaskActive ? COLORS.success : COLORS.warning }]} />
          <Text style={styles.statusPillText}>
            {bgTaskActive
              ? `24/7 Engine ON${data?.bot?.bg_tick_count ? ` · #${data.bot.bg_tick_count}` : ''}`
              : '24/7 Engine OFF (Tap)'}
          </Text>
        </TouchableOpacity>

        {/* Notification permission indicator */}
        <View style={styles.statusPill}>
          <Ionicons
            name={notifPermission ? 'notifications' : 'notifications-off-outline'}
            size={11}
            color={notifPermission ? COLORS.success : COLORS.warning}
          />
          <Text style={styles.statusPillText}>
            {notifPermission ? 'Alerts ON' : 'Alerts OFF'}
          </Text>
        </View>

        {/* Trade history button */}
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => setHistoryModalVisible(true)}
        >
          <Ionicons name="receipt-outline" size={12} color={COLORS.primary} />
          <Text style={styles.historyBtnText}>Trade Log</Text>
        </TouchableOpacity>
      </View>

      {/* Last trade notification inline banner */}
      {lastNotif && (
        <TouchableOpacity
          style={[
            styles.tradeBanner,
            { borderLeftColor: lastNotif.type === 'BUY' ? COLORS.success : COLORS.danger },
          ]}
          onPress={() => setLastNotif(null)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={lastNotif.type === 'BUY' ? 'arrow-up-circle' : 'arrow-down-circle'}
            size={16}
            color={lastNotif.type === 'BUY' ? COLORS.success : COLORS.danger}
          />
          <View style={styles.tradeBannerText}>
            <Text style={[styles.tradeBannerTitle, { color: lastNotif.type === 'BUY' ? COLORS.success : COLORS.danger }]}>
              {lastNotif.type} EXECUTED · {lastNotif.time}
            </Text>
            <Text style={styles.tradeBannerSub}>
              {parseFloat(lastNotif.qty || 0).toFixed(6)} {lastNotif.symbol?.replace('USDT', '')} @ ${parseFloat(lastNotif.price || 0).toLocaleString()}
            </Text>
          </View>
          <Ionicons name="close-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {/* Connection error banner */}
      {!isConnected && (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={18} color={COLORS.danger} />
          <View style={styles.errorTextContainer}>
            <Text style={styles.errorTitle}>Direct Exchange Error</Text>
            <Text style={styles.errorSub}>
              {errorMessage || 'Check internet connection and Binance Testnet API keys'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={styles.errorButtonText}>Keys</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Connecting directly to Binance...</Text>
          <Text style={styles.loadingSubtext}>Fetching testnet balances & positions</Text>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => setSettingsVisible(true)}
          >
            <Ionicons name="settings-outline" size={15} color={COLORS.primary} />
            <Text style={styles.configButtonText}>API Credentials</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadData(true)}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        >
          <PortfolioCard
            totalValue={data?.total_portfolio_usdt || 0}
            changePercent={data?.market?.change_percent_24h || 0}
            hideBalance={hideBalance}
            onToggleHide={() => setHideBalance(!hideBalance)}
            balances={data?.balances || []}
          />

          <PositionsSection
            positions={data?.positions || []}
            currentPrice={data?.market?.price || 0}
            hideBalance={hideBalance}
            onTradeSuccess={() => loadData(true)}
          />

          <BalancesSection
            balances={data?.balances || []}
            totalPortfolioValue={data?.total_portfolio_usdt || 0}
            hideBalance={hideBalance}
          />

          <MarketCard market={data?.market || {}} />

          <BotStatusCard
            bot={data?.bot || {}}
            onChangeStrategy={() => setStrategyModalVisible(true)}
          />
        </ScrollView>
      )}

      {/* Modals */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onRefreshData={() => loadData(true)}
      />

      <StrategyModal
        visible={strategyModalVisible}
        onClose={() => setStrategyModalVisible(false)}
        currentStrategyId={data?.bot?.strategy_id || 'DUAL_MA'}
        currentInterval={data?.bot?.interval || '1m'}
        allSignals={data?.all_strategy_signals || {}}
        onSelectStrategy={() => loadData(true)}
      />

      <TradeHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Status strip (bg engine + notification status)
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: COLORS.primaryGlow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  historyBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Trade executed inline banner
  tradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 10,
  },
  tradeBannerText: { flex: 1 },
  tradeBannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tradeBannerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  configButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  errorTextContainer: { flex: 1 },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  errorSub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  errorButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  errorButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
