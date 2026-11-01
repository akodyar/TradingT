import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import {
  fetchAccountBalances,
  fetchTicker24hr,
  fetchCandles,
  fetchExchangeStepSize,
  roundStep,
  executeMarketBuy,
  executeMarketSell,
  DEFAULT_API_KEY,
  DEFAULT_API_SECRET,
} from './binanceExchange.js';
import { getStrategySignal, STRATEGIES } from './strategyEngine.js';
import {
  sendBuyNotification,
  sendSellNotification,
  sendBotStatusNotification,
  sendErrorNotification,
} from './notificationService.js';
import {
  loadBotStateFromStorage,
  persistBotState,
  persistNewTrade,
} from './storageService.js';

// ─────────────────────────────────────────────
// Task name constant (must match registration)
// ─────────────────────────────────────────────
export const BACKGROUND_TRADE_TASK = 'BACKGROUND_TRADE_TASK';

// ─────────────────────────────────────────────
// In-memory cache synced with foreground App.js
// ─────────────────────────────────────────────
let _bgCache = {};

export function syncBackgroundState(state) {
  _bgCache = { ..._bgCache, ...state };
}

export function getBackgroundState() {
  return _bgCache;
}

/**
 * Core trading execution logic.
 * Executed continuously by Android Foreground Service & WorkManager.
 */
export async function runTradingEngineCycle() {
  try {
    // 1. ALWAYS load persisted settings and credentials from device disk
    const persisted = await loadBotStateFromStorage();

    const isEngineEnabled =
      _bgCache.isEngineEnabled !== undefined
        ? _bgCache.isEngineEnabled
        : persisted.isEngineRunning;

    if (!isEngineEnabled) {
      console.log('[24/7 Engine] Bot is disabled in settings. Skipping.');
      return BackgroundFetch.BackgroundFetchResult?.NoData || 'NO_DATA';
    }

    const credentials = {
      apiKey:
        _bgCache.credentials?.apiKey ||
        persisted.credentials?.apiKey ||
        DEFAULT_API_KEY,
      apiSecret:
        _bgCache.credentials?.apiSecret ||
        persisted.credentials?.apiSecret ||
        DEFAULT_API_SECRET,
    };

    const symbol = _bgCache.symbol || persisted.symbol || 'BTCUSDT';
    const interval = _bgCache.interval || persisted.interval || '1m';
    const quoteOrderSize =
      _bgCache.quoteOrderSize || persisted.quoteOrderSize || '20';
    const strategyId =
      _bgCache.strategyId || persisted.currentStrategyId || 'DUAL_MA';

    let positionQty =
      _bgCache.position_qty !== undefined
        ? _bgCache.position_qty
        : persisted.position_qty || '0';

    let lastCandle = persisted.last_candle || _bgCache.last_candle || null;

    if (!credentials.apiKey) {
      console.warn('[24/7 Engine] No API key available.');
      return BackgroundFetch.BackgroundFetchResult?.Failed || 'FAILED';
    }

    // 2. Fetch market data directly from Binance Spot Testnet
    const [ticker, candles, account] = await Promise.all([
      fetchTicker24hr(symbol),
      fetchCandles(symbol, interval, 60),
      fetchAccountBalances(credentials),
    ]);

    const currentPrice = parseFloat(ticker.lastPrice || '0');
    const strategyName = STRATEGIES[strategyId]?.name || strategyId;

    // 3. Evaluate strategy signal
    const { signal, details } = getStrategySignal(candles, strategyId);

    // 4. Closed candle timestamp
    let candleTime = null;
    if (candles && candles.length >= 2) {
      candleTime = String(candles[candles.length - 2][0]);
    }

    const now = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    console.log(
      `[24/7 Engine Tick] Signal: ${signal} | Price: $${currentPrice} | Position: ${positionQty} BTC | Time: ${now}`
    );

    // Send status heartbeat notification when signal is BUY or SELL
    if (signal !== 'HOLD') {
      await sendBotStatusNotification({
        signal,
        strategyName,
        lastCheck: now,
      });
    }

    // 5. Automated trade execution if new closed candle & condition met
    if (candleTime && candleTime !== lastCandle) {
      const botPositionQty = parseFloat(positionQty || '0');
      const rawBalances = account.balances || [];
      const usdtItem = rawBalances.find((b) => b.asset === 'USDT');
      const usdtFree = usdtItem ? parseFloat(usdtItem.free || '0') : 0;
      const orderSize = parseFloat(quoteOrderSize);

      if (signal === 'BUY' && botPositionQty === 0 && usdtFree >= orderSize) {
        // ── Execute BUY ──
        const order = await executeMarketBuy(symbol, orderSize, credentials);
        const boughtQty = parseFloat(order.executedQty || '0');
        const fillPrice = parseFloat(
          order.fills?.[0]?.price || String(currentPrice)
        );

        if (boughtQty > 0) {
          const newQty = boughtQty.toString();
          _bgCache.position_qty = newQty;
          _bgCache.last_candle = candleTime;

          const tradeRecord = {
            id: order.orderId,
            side: 'BUY',
            qty: boughtQty,
            price: fillPrice,
            time: new Date().toLocaleTimeString(),
          };

          await Promise.all([
            persistBotState({ position_qty: newQty, last_candle: candleTime }),
            persistNewTrade(tradeRecord),
          ]);

          await sendBuyNotification({
            symbol,
            qty: boughtQty,
            price: fillPrice,
            quoteSpent: orderSize,
            orderId: order.orderId,
          });
        }
      } else if (signal === 'SELL' && botPositionQty > 0) {
        // ── Execute SELL ──
        const step = await fetchExchangeStepSize(symbol);
        const sellQty = roundStep(botPositionQty, step);

        if (parseFloat(sellQty) > 0) {
          const order = await executeMarketSell(symbol, sellQty, credentials);
          const soldQty = parseFloat(order.executedQty || '0');
          const fillPrice = parseFloat(
            order.fills?.[0]?.price || String(currentPrice)
          );
          const received = soldQty * fillPrice;

          _bgCache.position_qty = '0';
          _bgCache.last_candle = candleTime;

          const tradeRecord = {
            id: order.orderId,
            side: 'SELL',
            qty: soldQty,
            price: fillPrice,
            time: new Date().toLocaleTimeString(),
          };

          await Promise.all([
            persistBotState({ position_qty: '0', last_candle: candleTime }),
            persistNewTrade(tradeRecord),
          ]);

          await sendSellNotification({
            symbol,
            qty: soldQty,
            price: fillPrice,
            quoteReceived: received,
            orderId: order.orderId,
          });
        }
      } else {
        _bgCache.last_candle = candleTime;
        await persistBotState({
          position_qty: positionQty,
          last_candle: candleTime,
        });
      }
    }

    return BackgroundFetch.BackgroundFetchResult?.NewData || 'NEW_DATA';
  } catch (err) {
    console.error('[24/7 Engine] Error:', err.message);
    await sendErrorNotification({ message: err.message });
    return BackgroundFetch.BackgroundFetchResult?.Failed || 'FAILED';
  }
}

// ─────────────────────────────────────────────
// TaskManager definition (runs headless even when app is closed / terminated)
// ─────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRADE_TASK, async () => {
  return await runTradingEngineCycle();
});

// ─────────────────────────────────────────────
// 24/7 Android Foreground Service Management
// ─────────────────────────────────────────────

/**
 * Start the true 24/7 Android Foreground Service.
 * Runs continuously in the background even if the app is closed or screen is off.
 */
export async function register247ForegroundService() {
  try {
    if (Platform.OS === 'android') {
      // 1. Request foreground permissions
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('[24/7 Service] Foreground location permission not granted');
      }

      // 2. Request background ("Allow all the time") permissions
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('[24/7 Service] Background location permission not granted');
      }

      // 3. Start Android Foreground Service with persistent status notification
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRADE_TASK);
      if (!isAlreadyRunning) {
        await Location.startLocationUpdatesAsync(BACKGROUND_TRADE_TASK, {
          accuracy: Location.Accuracy.Lowest, // Minimum power consumption
          timeInterval: 30000,               // Run every 30 seconds
          distanceInterval: 10000,           // Doesn't require movement
          deferredUpdatesInterval: 30000,
          foregroundService: {
            notificationTitle: 'Trading Bot 24/7 Engine Active',
            notificationBody: 'Evaluating strategies and trading autonomously.',
            notificationColor: '#3B82F6',
            killServiceOnDestroy: false,     // Keeps running even if app is terminated
          },
        });
        console.log('[24/7 Service] Android Foreground Service active ✅');
      }
    }

    // 4. Also register WorkManager background fetch as secondary layer
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TRADE_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (_) {}

    return true;
  } catch (err) {
    console.warn('[24/7 Service] Error starting foreground service:', err.message);
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_TRADE_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      return true;
    } catch (_) {
      return false;
    }
  }
}

export async function stop247ForegroundService() {
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRADE_TASK);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRADE_TASK);
    }
  } catch (_) {}
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TRADE_TASK);
  } catch (_) {}
  console.log('[24/7 Service] Background service stopped');
}

export async function is247ServiceActive() {
  try {
    if (Platform.OS === 'android') {
      const isLocStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRADE_TASK);
      if (isLocStarted) return true;
    }
  } catch (_) {}
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_TRADE_TASK);
}

// Backward compatibility alias
export const registerBackgroundTask = register247ForegroundService;
export const isBackgroundTaskRegistered = is247ServiceActive;
export const unregisterBackgroundTask = stop247ForegroundService;
