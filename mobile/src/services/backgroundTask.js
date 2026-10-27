import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import {
  fetchAccountBalances,
  fetchTicker24hr,
  fetchCandles,
  fetchExchangeStepSize,
  roundStep,
  executeMarketBuy,
  executeMarketSell,
} from './binanceExchange.js';
import { getStrategySignal, STRATEGIES } from './strategyEngine.js';
import {
  sendBuyNotification,
  sendSellNotification,
  sendBotStatusNotification,
  sendErrorNotification,
} from './notificationService.js';

// ─────────────────────────────────────────────
// Task name constant (must match registration)
// ─────────────────────────────────────────────
export const BACKGROUND_TRADE_TASK = 'BACKGROUND_TRADE_TASK';

// ─────────────────────────────────────────────
// Shared in-memory state (persisted across bg cycles via module scope)
// ─────────────────────────────────────────────
let _bgState = {
  position_qty: '0',
  last_candle: null,
  credentials: null,        // set by foreground app
  symbol: 'BTCUSDT',
  interval: '1h',
  quoteOrderSize: '20',
  strategyId: 'DUAL_MA',
  isEngineEnabled: true,
};

/** Called by foreground App.js to keep background state in sync */
export function syncBackgroundState(state) {
  _bgState = { ..._bgState, ...state };
}

export function getBackgroundState() {
  return _bgState;
}

// ─────────────────────────────────────────────
// Register the TaskManager task (MUST be at top level, outside components)
// ─────────────────────────────────────────────
TaskManager.defineTask(BACKGROUND_TRADE_TASK, async () => {
  try {
    if (!_bgState.isEngineEnabled) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const {
      credentials,
      symbol,
      interval,
      quoteOrderSize,
      strategyId,
    } = _bgState;

    if (!credentials?.apiKey) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // 1. Fetch market data
    const [ticker, candles, account] = await Promise.all([
      fetchTicker24hr(symbol),
      fetchCandles(symbol, interval, 60),
      fetchAccountBalances(credentials),
    ]);

    const currentPrice = parseFloat(ticker.lastPrice || '0');
    const strategyName = STRATEGIES[strategyId]?.name || strategyId;

    // 2. Evaluate strategy
    const { signal, details } = getStrategySignal(candles, strategyId);

    // 3. Get closed candle timestamp to avoid re-triggering on same candle
    let candleTime = null;
    if (candles && candles.length >= 2) {
      candleTime = String(candles[candles.length - 2][0]);
    }

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // 4. Send heartbeat only if signal changed to BUY or SELL (avoid HOLD spam)
    if (signal !== 'HOLD') {
      await sendBotStatusNotification({
        signal,
        strategyName,
        lastCheck: now,
      });
    }

    // 5. Execute automated trade if new candle & signal
    if (candleTime && candleTime !== _bgState.last_candle) {
      const botPositionQty = parseFloat(_bgState.position_qty || '0');
      const rawBalances = account.balances || [];
      const usdtItem = rawBalances.find((b) => b.asset === 'USDT');
      const usdtFree = usdtItem ? parseFloat(usdtItem.free || '0') : 0;
      const orderSize = parseFloat(quoteOrderSize);

      if (signal === 'BUY' && botPositionQty === 0 && usdtFree >= orderSize) {
        // ── Execute BUY ──
        const order = await executeMarketBuy(symbol, orderSize, credentials);
        const boughtQty = parseFloat(order.executedQty || '0');
        const fillPrice = parseFloat(order.fills?.[0]?.price || String(currentPrice));

        if (boughtQty > 0) {
          _bgState.position_qty = boughtQty.toString();
          _bgState.last_candle = candleTime;

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
          const fillPrice = parseFloat(order.fills?.[0]?.price || String(currentPrice));
          const received = soldQty * fillPrice;

          _bgState.position_qty = '0';
          _bgState.last_candle = candleTime;

          await sendSellNotification({
            symbol,
            qty: soldQty,
            price: fillPrice,
            quoteReceived: received,
            orderId: order.orderId,
          });
        }
      } else {
        // No trade, still advance last_candle to avoid repeat checks
        _bgState.last_candle = candleTime;
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
 * Register the background fetch task.
 * Android: minimum interval ~15 min (OS enforced).
 * Call this once after notification permissions are granted.
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
      minimumInterval: 15 * 60, // 15 minutes (Android minimum)
      stopOnTerminate: false,   // keep running after app is closed
      startOnBoot: true,        // restart after phone reboot
    });

    console.log('[BG] Background task registered ✅');
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
    // May throw if not registered yet
  }
}

export async function isBackgroundTaskRegistered() {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_TRADE_TASK);
}
