import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

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

// ─────────────────────────────────────────────
// TaskManager definition (runs headless even when app is closed / terminated)
// ─────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRADE_TASK, async () => {
  try {
    // 1. ALWAYS load persisted settings and credentials from device storage
    const persisted = await loadBotStateFromStorage();

    const isEngineEnabled =
      _bgCache.isEngineEnabled !== undefined
        ? _bgCache.isEngineEnabled
        : persisted.isEngineRunning;

    if (!isEngineEnabled) {
      console.log('[BG Task] Bot engine is disabled in settings. Skipping.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
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
      console.warn('[BG Task] No API key available.');
      return BackgroundFetch.BackgroundFetchResult.Failed;
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
      `[BG Task] 24/7 Tick | Signal: ${signal} | Price: $${currentPrice} | Position: ${positionQty} BTC`
    );

    // Send heartbeat notification when signal is active or changing
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
        // Advance last_candle to avoid repeated checks on same candle
        _bgCache.last_candle = candleTime;
        await persistBotState({
          position_qty: positionQty,
          last_candle: candleTime,
        });
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error('[BG Task] Error:', err.message);
    await sendErrorNotification({ message: err.message });
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─────────────────────────────────────────────
// Registration helpers
// ─────────────────────────────────────────────

/**
 * Register the background fetch task with Android WorkManager.
 * Runs periodically even if the app process is terminated.
 */
export async function registerBackgroundTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    const isAvailable =
      status === BackgroundFetch.BackgroundFetchStatus.Available;

    if (!isAvailable) {
      console.warn('[BG] Background fetch not available on this device/OS');
      return false;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_TRADE_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (Android WorkManager interval)
      stopOnTerminate: false,   // Keeps running even if app is terminated
      startOnBoot: true,        // Automatically resumes after device reboot
    });

    console.log('[BG] 24/7 Background task registered successfully ✅');
    return true;
  } catch (err) {
    console.warn('[BG] Could not register background task:', err.message);
    return false;
  }
}

export async function unregisterBackgroundTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TRADE_TASK);
    console.log('[BG] Background task unregistered');
  } catch (_) {
    // May throw if not registered
  }
}

export async function isBackgroundTaskRegistered() {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_TRADE_TASK);
}
