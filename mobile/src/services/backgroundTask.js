import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform, AppState, Linking } from 'react-native';

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
// Task name constants (SEPARATE names so Location & BackgroundFetch never collide!)
// ─────────────────────────────────────────────
export const BACKGROUND_TRADE_TASK = 'BACKGROUND_TRADE_TASK';
export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TRADE_TASK';
export const BACKGROUND_FETCH_TASK = 'BACKGROUND_FETCH_TRADE_TASK';

// ─────────────────────────────────────────────
// In-memory cache & execution lock
// ─────────────────────────────────────────────
let _bgCache = {};
let _isCycleRunning = false;
let _lastCycleTimestamp = 0;
let _bgTimerId = null;
let _appStateSubscription = null;
let _tickCounter = 0;

const MIN_CYCLE_INTERVAL_MS = 10000; // Prevent duplicate overlapping cycles within 10s
const BG_LOOP_INTERVAL_MS = 20000;   // Continuous 20s heartbeat loop while service keeps JS alive

export function syncBackgroundState(state) {
  _bgCache = { ..._bgCache, ...state };
}

export function getBackgroundState() {
  return _bgCache;
}

/**
 * Core 24/7 trading execution logic.
 * Invoked by:
 *  1. Android/iOS Foreground Service Location heartbeat (every 15s, distanceInterval: 0)
 *  2. Continuous JS background timer kept alive by the Foreground Service (every 20s)
 *  3. OS WorkManager / BackgroundFetch fallback
 */
export async function runTradingEngineCycle(triggerSource = 'bg') {
  // Mutex + rate-limit guard so multiple wakeup sources never double-fire orders
  const nowMs = Date.now();
  if (_isCycleRunning) {
    return BackgroundFetch.BackgroundFetchResult?.NoData || 'SKIPPED_LOCKED';
  }
  if (
    triggerSource !== 'manual' &&
    triggerSource !== 'appstate-bg' &&
    nowMs - _lastCycleTimestamp < MIN_CYCLE_INTERVAL_MS
  ) {
    return BackgroundFetch.BackgroundFetchResult?.NoData || 'SKIPPED_RECENT';
  }

  _isCycleRunning = true;
  _lastCycleTimestamp = nowMs;

  try {
    // 1. ALWAYS load latest persisted settings and credentials from device disk
    const persisted = await loadBotStateFromStorage();

    const isEngineEnabled =
      persisted.isEngineRunning !== undefined
        ? persisted.isEngineRunning
        : _bgCache.isEngineEnabled ?? true;

    if (!isEngineEnabled) {
      console.log('[24/7 Engine] Bot is paused in settings. Skipping cycle.');
      return BackgroundFetch.BackgroundFetchResult?.NoData || 'NO_DATA';
    }

    const credentials = {
      apiKey:
        persisted.credentials?.apiKey ||
        _bgCache.credentials?.apiKey ||
        DEFAULT_API_KEY,
      apiSecret:
        persisted.credentials?.apiSecret ||
        _bgCache.credentials?.apiSecret ||
        DEFAULT_API_SECRET,
    };

    const symbol = persisted.symbol || _bgCache.symbol || 'BTCUSDT';
    const interval = persisted.interval || _bgCache.interval || '1m';
    const quoteOrderSize =
      persisted.quoteOrderSize || _bgCache.quoteOrderSize || '20';
    const strategyId =
      persisted.currentStrategyId || _bgCache.strategyId || 'DUAL_MA';

    let storedPositionQty = parseFloat(
      persisted.position_qty !== undefined
        ? persisted.position_qty
        : _bgCache.position_qty || '0'
    );
    if (isNaN(storedPositionQty) || storedPositionQty < 0) {
      storedPositionQty = 0;
    }

    let lastTradedCandle = persisted.last_candle || _bgCache.last_candle || null;

    if (!credentials.apiKey) {
      console.warn('[24/7 Engine] No API key available.');
      return BackgroundFetch.BackgroundFetchResult?.Failed || 'FAILED';
    }

    // 2. Fetch live market data & account balances directly from Binance Spot Testnet
    const [ticker, candles, account] = await Promise.all([
      fetchTicker24hr(symbol),
      fetchCandles(symbol, interval, 60),
      fetchAccountBalances(credentials),
    ]);

    const currentPrice = parseFloat(ticker.lastPrice || '0');
    const strategyName =
      STRATEGIES[strategyId]?.shortName ||
      STRATEGIES[strategyId]?.name ||
      strategyId;

    // 3. Reconcile stored position with actual live BTC & USDT balances on Binance
    const rawBalances = account.balances || [];
    const usdtItem = rawBalances.find((b) => b.asset === 'USDT');
    const btcItem = rawBalances.find((b) => b.asset === 'BTC');
    const usdtFree = usdtItem ? parseFloat(usdtItem.free || '0') : 0;
    const btcFree = btcItem ? parseFloat(btcItem.free || '0') : 0;

    // If actual BTC balance on exchange is worth less than $5, treat position as flat (0)
    // so a stale stored position_qty never blocks new BUY orders.
    let botPositionQty = storedPositionQty;
    if (currentPrice > 0 && btcFree * currentPrice < 5) {
      botPositionQty = 0;
    } else if (botPositionQty > btcFree) {
      botPositionQty = btcFree;
    }

    // 4. Evaluate strategy signal
    const { signal } = getStrategySignal(candles, strategyId);

    // 5. Identify current closed candle timestamp
    let candleTime = null;
    if (candles && candles.length >= 2) {
      candleTime = String(candles[candles.length - 2][0]);
    }

    _tickCounter = (persisted.bg_tick_count || _tickCounter || 0) + 1;
    const nowTimeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    console.log(
      `[24/7 Engine #${_tickCounter} via ${triggerSource}] Signal: ${signal} | Price: $${currentPrice} | Pos: ${botPositionQty} BTC | Free USDT: $${usdtFree.toFixed(2)} | Time: ${nowTimeStr}`
    );

    // 6. Automated trade execution
    // IMPORTANT: lastTradedCandle only tracks candles where a trade was ACTUALLY executed!
    const orderSize = parseFloat(quoteOrderSize || '20');
    let finalPositionStr = botPositionQty.toString();
    let finalCandle = lastTradedCandle;

    if (candleTime && candleTime !== lastTradedCandle) {
      if (signal === 'BUY' && botPositionQty === 0 && usdtFree >= orderSize) {
        // ── Execute BUY ──
        const order = await executeMarketBuy(symbol, orderSize, credentials);
        const boughtQty = parseFloat(order.executedQty || '0');
        const fillPrice = parseFloat(
          order.fills?.[0]?.price || String(currentPrice)
        );

        if (boughtQty > 0) {
          finalPositionStr = boughtQty.toString();
          finalCandle = candleTime;
          _bgCache.position_qty = finalPositionStr;
          _bgCache.last_candle = finalCandle;

          const tradeRecord = {
            id: order.orderId,
            side: 'BUY',
            qty: boughtQty,
            price: fillPrice,
            time: new Date().toLocaleTimeString(),
          };

          await persistNewTrade(tradeRecord);
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
        const sellQty = roundStep(Math.min(botPositionQty, btcFree), step);

        if (parseFloat(sellQty) > 0) {
          const order = await executeMarketSell(symbol, sellQty, credentials);
          const soldQty = parseFloat(order.executedQty || '0');
          const fillPrice = parseFloat(
            order.fills?.[0]?.price || String(currentPrice)
          );
          const received = soldQty * fillPrice;

          finalPositionStr = '0';
          finalCandle = candleTime;
          _bgCache.position_qty = '0';
          _bgCache.last_candle = finalCandle;

          const tradeRecord = {
            id: order.orderId,
            side: 'SELL',
            qty: soldQty,
            price: fillPrice,
            time: new Date().toLocaleTimeString(),
          };

          await persistNewTrade(tradeRecord);
          await sendSellNotification({
            symbol,
            qty: soldQty,
            price: fillPrice,
            quoteReceived: received,
            orderId: order.orderId,
          });
        }
      }
    }

    // 7. Persist heartbeat & reconciled position state
    _bgCache.position_qty = finalPositionStr;
    _bgCache.last_bg_tick = nowTimeStr;
    _bgCache.bg_tick_count = _tickCounter;

    await persistBotState({
      position_qty: finalPositionStr,
      last_candle: finalCandle,
      last_bg_tick: nowTimeStr,
      bg_tick_count: _tickCounter,
    });

    // 8. Update persistent 24/7 status notification so user sees live proof in notification tray
    await sendBotStatusNotification({
      signal,
      strategyName,
      interval,
      price: currentPrice,
      positionQty: finalPositionStr,
      lastCheck: nowTimeStr,
      tickCount: _tickCounter,
    });

    return BackgroundFetch.BackgroundFetchResult?.NewData || 'NEW_DATA';
  } catch (err) {
    console.error('[24/7 Engine] Error:', err.message);
    return BackgroundFetch.BackgroundFetchResult?.Failed || 'FAILED';
  } finally {
    _isCycleRunning = false;
  }
}

// ─────────────────────────────────────────────
// TaskManager definitions (run headless even when app is closed / backgrounded)
// ─────────────────────────────────────────────
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ error }) => {
    if (error) {
      console.warn('[24/7 Location Task] Error:', error.message);
      return;
    }
    await runTradingEngineCycle('location-fgs');
  });
}

if (!TaskManager.isTaskDefined(BACKGROUND_FETCH_TASK)) {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    return await runTradingEngineCycle('workmanager-fetch');
  });
}

if (!TaskManager.isTaskDefined(BACKGROUND_TRADE_TASK)) {
  TaskManager.defineTask(BACKGROUND_TRADE_TASK, async () => {
    return await runTradingEngineCycle('legacy-task');
  });
}

// ─────────────────────────────────────────────
// Continuous Background Loop & AppState Monitor
// ─────────────────────────────────────────────
export function startContinuousBackgroundLoop() {
  if (!_bgTimerId) {
    _bgTimerId = setInterval(() => {
      // Runs continuously while Foreground Service keeps the JS runtime awake
      if (AppState.currentState !== 'active') {
        runTradingEngineCycle('bg-timer');
      }
    }, BG_LOOP_INTERVAL_MS);
  }

  if (!_appStateSubscription) {
    _appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        console.log('[24/7 Service] App entered background — executing immediate trading check');
        runTradingEngineCycle('appstate-bg');
      }
    });
  }
}

export function stopContinuousBackgroundLoop() {
  if (_bgTimerId) {
    clearInterval(_bgTimerId);
    _bgTimerId = null;
  }
  if (_appStateSubscription) {
    _appStateSubscription.remove();
    _appStateSubscription = null;
  }
}

// ─────────────────────────────────────────────
// 24/7 Android/iOS Foreground Service Management
// ─────────────────────────────────────────────

/**
 * Start the 24/7 Foreground Service + Continuous Background Loop + WorkManager fallback.
 */
export async function register247ForegroundService() {
  // Always start the continuous JS background timer & AppState listener immediately
  startContinuousBackgroundLoop();

  let nativeServiceStarted = false;

  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      // 1. Request foreground location permission
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();

      if (fgStatus === 'granted') {
        // 2. Request background ("Allow all the time") permission (don't block if user only granted "While using" - foreground service still runs!)
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (bgPermErr) {
          console.warn('[24/7 Service] Background permission note:', bgPermErr.message);
        }

        // 3. Restart Foreground Service with distanceInterval: 0 so stationary devices still fire every 15s!
        const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK
        );
        if (isAlreadyRunning) {
          try {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          } catch (_) {}
        }

        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 15000,               // Wake every 15 seconds
          distanceInterval: 0,               // 0m = fire even when phone is completely stationary!
          deferredUpdatesInterval: 0,
          deferredUpdatesDistance: 0,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: '⚡ Trading Bot 24/7 Engine Active',
            notificationBody: 'Autonomous background trading is running continuously.',
            notificationColor: '#10B981',
            killServiceOnDestroy: false,     // Keep service alive even if activity is swiped
          },
        });
        nativeServiceStarted = true;
        console.log('[24/7 Service] Android/iOS Foreground Service active (15s interval, 0m distance) ✅');
      } else {
        console.warn('[24/7 Service] Foreground location permission not granted');
      }
    }
  } catch (err) {
    console.warn('[24/7 Service] Foreground location service warning:', err.message);
  }

  // 4. Register OS WorkManager / BackgroundFetch on its OWN separate task name
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60, // Request fastest allowed OS interval
      stopOnTerminate: false,
      startOnBoot: true,
    });
    nativeServiceStarted = true;
  } catch (_) {}

  // Trigger an initial cycle to post the sticky live notification right away
  runTradingEngineCycle('startup');

  return nativeServiceStarted || Boolean(_bgTimerId);
}

export async function stop247ForegroundService() {
  stopContinuousBackgroundLoop();
  try {
    const isStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (_) {}
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  } catch (_) {}
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TRADE_TASK);
  } catch (_) {}
  console.log('[24/7 Service] Background service stopped');
}

export async function is247ServiceActive() {
  if (_bgTimerId) return true;
  try {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const isLocStarted = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK
      );
      if (isLocStarted) return true;
    }
  } catch (_) {}
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  } catch (_) {
    return false;
  }
}

/**
 * Open Android Battery Optimization settings so user can set "Unrestricted"
 */
export async function requestBatteryOptimizationExemption() {
  if (Platform.OS === 'android') {
    try {
      await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    } catch (_) {
      try {
        await Linking.openSettings();
      } catch (_) {}
    }
  }
}

// Backward compatibility aliases
export const registerBackgroundTask = register247ForegroundService;
export const isBackgroundTaskRegistered = is247ServiceActive;
export const unregisterBackgroundTask = stop247ForegroundService;
