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
} from './notificationService.js';
import { syncBackgroundState } from './backgroundTask.js';
import {
  loadBotStateFromStorage,
  persistBotCredentials,
  persistBotConfig,
  persistBotState,
  persistNewTrade,
} from './storageService.js';

// Bot in-app state
let botState = {
  isEngineRunning: true,
  currentStrategyId: 'DUAL_MA',
  position_qty: '0',
  last_candle: null,
  last_bg_tick: null,
  bg_tick_count: 0,
  symbol: 'BTCUSDT',
  interval: '1m',
  quoteOrderSize: '20',
  trades: [],
  credentials: {
    apiKey: DEFAULT_API_KEY,
    apiSecret: DEFAULT_API_SECRET,
  },
};

let _isInitialized = false;

/**
 * Initialize or reload bot state from device persistent storage.
 * Always pulls latest position_qty, trades, and background heartbeat stats
 * so background trades are never overwritten by stale foreground state.
 */
export async function initBotManager(forceReload = false) {
  try {
    const loaded = await loadBotStateFromStorage();
    if (!_isInitialized || forceReload) {
      botState = {
        ...botState,
        ...loaded,
      };
      _isInitialized = true;
    } else {
      // Always sync dynamic runtime state written by the 24/7 background task
      botState.position_qty = loaded.position_qty ?? botState.position_qty;
      botState.last_candle = loaded.last_candle ?? botState.last_candle;
      botState.last_bg_tick = loaded.last_bg_tick ?? botState.last_bg_tick;
      botState.bg_tick_count = loaded.bg_tick_count ?? botState.bg_tick_count;
      if (Array.isArray(loaded.trades)) {
        botState.trades = loaded.trades;
      }
    }
    syncBackgroundState({
      credentials: botState.credentials,
      symbol: botState.symbol,
      interval: botState.interval,
      quoteOrderSize: botState.quoteOrderSize,
      strategyId: botState.currentStrategyId,
      position_qty: botState.position_qty,
      last_candle: botState.last_candle,
      isEngineEnabled: botState.isEngineRunning,
    });
  } catch (e) {
    console.warn('[BotManager] Storage load error:', e.message);
  }
  return botState;
}

export function getBotState() {
  return botState;
}

export async function setStrategy(strategyId) {
  if (STRATEGIES[strategyId]) {
    botState.currentStrategyId = strategyId;
    await persistBotConfig({
      isEngineRunning: botState.isEngineRunning,
      currentStrategyId: botState.currentStrategyId,
      symbol: botState.symbol,
      interval: botState.interval,
      quoteOrderSize: botState.quoteOrderSize,
    });
    syncBackgroundState({ strategyId });
  }
}

export async function setCandleInterval(interval) {
  if (interval) {
    botState.interval = interval;
    await persistBotConfig({
      isEngineRunning: botState.isEngineRunning,
      currentStrategyId: botState.currentStrategyId,
      symbol: botState.symbol,
      interval: botState.interval,
      quoteOrderSize: botState.quoteOrderSize,
    });
    syncBackgroundState({ interval });
  }
}

export async function setStrategyAndInterval(strategyId, interval) {
  if (strategyId && STRATEGIES[strategyId]) {
    botState.currentStrategyId = strategyId;
  }
  if (interval) {
    botState.interval = interval;
  }
  await persistBotConfig({
    isEngineRunning: botState.isEngineRunning,
    currentStrategyId: botState.currentStrategyId,
    symbol: botState.symbol,
    interval: botState.interval,
    quoteOrderSize: botState.quoteOrderSize,
  });
  syncBackgroundState({
    strategyId: botState.currentStrategyId,
    interval: botState.interval,
  });
}

export async function applyMinimumRiskConfiguration() {
  botState.currentStrategyId = 'DUAL_MA';
  botState.interval = '1h';
  await persistBotConfig({
    isEngineRunning: botState.isEngineRunning,
    currentStrategyId: botState.currentStrategyId,
    symbol: botState.symbol,
    interval: botState.interval,
    quoteOrderSize: botState.quoteOrderSize,
  });
  syncBackgroundState({
    strategyId: 'DUAL_MA',
    interval: '1h',
  });
}

export async function updateBotCredentials(apiKey, apiSecret) {
  botState.credentials = {
    apiKey: apiKey || DEFAULT_API_KEY,
    apiSecret: apiSecret || DEFAULT_API_SECRET,
  };
  await persistBotCredentials(botState.credentials);
  syncBackgroundState({ credentials: botState.credentials });
}

export async function setEngineRunning(isRunning) {
  botState.isEngineRunning = isRunning;
  await persistBotConfig({
    isEngineRunning: botState.isEngineRunning,
    currentStrategyId: botState.currentStrategyId,
    symbol: botState.symbol,
    interval: botState.interval,
    quoteOrderSize: botState.quoteOrderSize,
  });
  syncBackgroundState({ isEngineEnabled: isRunning });
}

/**
 * Execute a manual Buy trade directly from the mobile app
 */
export async function executeManualBuy(quoteAmount) {
  const symbol = botState.symbol;
  const res = await executeMarketBuy(symbol, quoteAmount, botState.credentials);
  const boughtQty = parseFloat(res.executedQty || '0');
  const fillPrice = parseFloat(res.fills?.[0]?.price || '0');

  if (boughtQty > 0) {
    const currentQty = parseFloat(botState.position_qty || '0');
    botState.position_qty = (currentQty + boughtQty).toString();
    const newTrade = {
      id: res.orderId,
      side: 'BUY',
      qty: boughtQty,
      price: fillPrice,
      time: new Date().toLocaleTimeString(),
    };
    botState.trades.unshift(newTrade);
    await persistNewTrade(newTrade);
    await persistBotState({ position_qty: botState.position_qty, last_candle: botState.last_candle });
    // 🔔 Notify
    await sendBuyNotification({
      symbol,
      qty: boughtQty,
      price: fillPrice,
      quoteSpent: quoteAmount,
      orderId: res.orderId,
    });
    // Sync background task state
    syncBackgroundState({ position_qty: botState.position_qty });
  }
  return res;
}

/**
 * Execute a manual Sell trade directly from the mobile app
 */
export async function executeManualSell(quantity) {
  const symbol = botState.symbol;
  const step = await fetchExchangeStepSize(symbol);
  const sellQty = roundStep(quantity, step);

  if (parseFloat(sellQty) <= 0) {
    throw new Error('Quantity too small after lot size rounding');
  }

  const res = await executeMarketSell(symbol, sellQty, botState.credentials);
  const soldQty = parseFloat(res.executedQty || '0');
  const fillPrice = parseFloat(res.fills?.[0]?.price || '0');

  if (soldQty > 0) {
    const currentQty = parseFloat(botState.position_qty || '0');
    botState.position_qty = Math.max(0, currentQty - soldQty).toString();
    const newTrade = {
      id: res.orderId,
      side: 'SELL',
      qty: soldQty,
      price: fillPrice,
      time: new Date().toLocaleTimeString(),
    };
    botState.trades.unshift(newTrade);
    await persistNewTrade(newTrade);
    await persistBotState({ position_qty: botState.position_qty, last_candle: botState.last_candle });
    // 🔔 Notify
    await sendSellNotification({
      symbol,
      qty: soldQty,
      price: fillPrice,
      quoteReceived: soldQty * fillPrice,
      orderId: res.orderId,
    });
    // Sync background task state
    syncBackgroundState({ position_qty: botState.position_qty });
  }
  return res;
}

/**
 * Fetch and assemble all dashboard overview data directly from Binance
 */
export async function getDashboardOverview() {
  await initBotManager();
  const symbol = botState.symbol;
  const interval = botState.interval;
  const credentials = botState.credentials;
  const activeStrategy = STRATEGIES[botState.currentStrategyId] || STRATEGIES.DUAL_MA;

  let ticker, account;
  try {
    ticker = await fetchTicker24hr(symbol);
    account = await fetchAccountBalances(credentials);
  } catch (directErr) {
    if (typeof window !== 'undefined') {
      try {
        const fallbackRes = await fetch('http://localhost:8000/api/overview');
        if (fallbackRes.ok) {
          const fb = await fallbackRes.json();
          ticker = {
            lastPrice: String(fb.market?.price || '0'),
            priceChangePercent: String(fb.market?.change_percent_24h || '0'),
            highPrice: String(fb.market?.high_24h || '0'),
            lowPrice: String(fb.market?.low_24h || '0'),
          };
          account = {
            balances: (fb.balances || []).map((b) => ({
              asset: b.asset,
              free: String(b.free_raw !== undefined ? b.free_raw : b.free),
              locked: String(b.locked_raw !== undefined ? b.locked_raw : b.locked),
            })),
          };
        } else {
          throw directErr;
        }
      } catch (_) {
        throw directErr;
      }
    } else {
      throw directErr;
    }
  }

  const currentPrice = parseFloat(ticker.lastPrice || '0');
  const priceChangePercent = parseFloat(ticker.priceChangePercent || '0');
  const high24h = parseFloat(ticker.highPrice || '0');
  const low24h = parseFloat(ticker.lowPrice || '0');

  const rawBalances = account.balances || [];

  // Filter out zero-balance coins: Only include assets where total > 0
  // Also filter out non-standard test strings (like "这是测试币", "456")
  let totalPortfolioUsdt = 0;
  const balancesList = [];

  const priceMap = {
    USDT: 1.0,
    BTC: currentPrice,
    ETH: 3100.0,
    BNB: 580.0,
    SOL: 180.0,
  };

  const isStandardCoin = (asset) => /^[A-Z0-9]{2,8}$/.test(asset);

  for (const item of rawBalances) {
    const free = parseFloat(item.free || '0');
    const locked = parseFloat(item.locked || '0');
    const total = free + locked;
    const asset = item.asset;

    // Strict filter: strictly greater than 0 balance and valid asset code
    if (total > 0.00000001 && isStandardCoin(asset)) {
      const unitPrice = priceMap[asset] !== undefined ? priceMap[asset] : 0;
      const valueUsdt = total * unitPrice;
      totalPortfolioUsdt += valueUsdt;

      balancesList.push({
        asset,
        free: free.toFixed(8).replace(/\.?0+$/, ''),
        locked: locked.toFixed(8).replace(/\.?0+$/, ''),
        total: total.toFixed(8).replace(/\.?0+$/, ''),
        free_raw: free,
        locked_raw: locked,
        total_raw: total,
        value_usdt: valueUsdt,
      });
    }
  }

  // Sort: USDT first, BTC second, then highest USD value
  balancesList.sort((a, b) => {
    if (a.asset === 'USDT') return -1;
    if (b.asset === 'USDT') return 1;
    if (a.asset === 'BTC') return -1;
    if (b.asset === 'BTC') return 1;
    return b.value_usdt - a.value_usdt;
  });

  // 3. Fetch Candles & Evaluate Strategy
  const candles = await fetchCandles(symbol, interval, 60);

  // Evaluate currently active strategy
  const strategyResult = getStrategySignal(candles, botState.currentStrategyId);

  // Pre-calculate signals for ALL strategies so the selector modal displays live preview
  const allStrategySignals = {};
  for (const sKey of Object.keys(STRATEGIES)) {
    allStrategySignals[sKey] = getStrategySignal(candles, sKey);
  }

  let lastCandleDt = 'Syncing...';
  let candleTime = null;
  if (candles && candles.length >= 2) {
    const closedCandle = candles[candles.length - 2];
    candleTime = String(closedCandle[0]);
    const d = new Date(closedCandle[0]);
    lastCandleDt = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  }

  // 4. Sparkline (last 24 closes)
  const sparkline = candles.slice(-24).map((c) => parseFloat(c[4]));

  // 5. Build DUAL POSITIONS (BOTH BUY & SELL SIDES)
  const usdtAsset = balancesList.find((b) => b.asset === 'USDT');
  const btcAsset = balancesList.find((b) => b.asset === 'BTC');

  const usdtFree = usdtAsset ? usdtAsset.free_raw : 0;
  const btcFree = btcAsset ? btcAsset.free_raw : 0;
  let botPositionQty = parseFloat(botState.position_qty || '0');

  // Reconcile stored position with actual exchange BTC balance so a stale position_qty never blocks buying
  if (currentPrice > 0 && btcFree * currentPrice < 5) {
    botPositionQty = 0;
    botState.position_qty = '0';
  } else if (botPositionQty > btcFree) {
    botPositionQty = btcFree;
    botState.position_qty = btcFree.toString();
  }

  const positions = [
    {
      id: 'buy_side',
      side: 'BUY',
      name: 'Buy Position / Cash Ready',
      symbol,
      asset: 'USDT',
      targetAsset: 'BTC',
      availableCash: usdtFree,
      value_usdt: usdtFree,
      current_price: currentPrice,
      maxPurchasable: currentPrice > 0 ? usdtFree / currentPrice : 0,
      status: usdtFree >= 20 ? 'READY TO BUY' : 'LOW CASH',
      signal: strategyResult.signal,
      type: 'Buying Power (Quote Asset)',
    },
    {
      id: 'sell_side',
      side: 'SELL',
      name: 'Sell Position / Active Holdings',
      symbol,
      asset: 'BTC',
      targetAsset: 'USDT',
      quantity: btcFree,
      botQuantity: botPositionQty,
      value_usdt: btcFree * currentPrice,
      current_price: currentPrice,
      status: btcFree > 0 ? 'READY TO SELL' : 'NO HOLDINGS',
      signal: strategyResult.signal,
      type: 'Spot Inventory (Base Asset)',
    },
  ];

  // 6. Automated Engine Cycle
  if (botState.isEngineRunning && candleTime && candleTime !== botState.last_candle) {
    await runAutomatedTradeCycle({
      signal: strategyResult.signal,
      candleTime,
      botPositionQty,
      btcFree,
      currentPrice,
      balancesList,
      credentials,
      strategyName: activeStrategy.shortName || activeStrategy.name,
    });
  }

  return {
    success: true,
    timestamp: Date.now(),
    total_portfolio_usdt: totalPortfolioUsdt,
    market: {
      symbol,
      price: currentPrice,
      change_percent_24h: priceChangePercent,
      high_24h: high24h,
      low_24h: low24h,
      sparkline,
    },
    balances: balancesList,
    positions,
    bot: {
      symbol,
      interval,
      quote_order_size: botState.quoteOrderSize,
      strategy_id: botState.currentStrategyId,
      strategy_name: activeStrategy.name,
      strategy_short: activeStrategy.shortName,
      strategy_type: activeStrategy.type,
      current_signal: strategyResult.signal,
      signal_details: strategyResult.details,
      position_qty: botState.position_qty,
      last_candle_time: lastCandleDt,
      last_bg_tick: botState.last_bg_tick,
      bg_tick_count: botState.bg_tick_count || 0,
      status: botState.isEngineRunning ? 'RUNNING' : 'PAUSED',
    },
    strategies: STRATEGIES,
    all_strategy_signals: allStrategySignals,
  };
}

async function runAutomatedTradeCycle({
  signal,
  candleTime,
  botPositionQty,
  btcFree,
  currentPrice,
  balancesList,
  credentials,
  strategyName,
}) {
  try {
    const symbol = botState.symbol;
    const quoteOrderSize = parseFloat(botState.quoteOrderSize || '20');
    const nowTimeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    if (signal === 'BUY' && botPositionQty === 0) {
      const usdtItem = balancesList.find((b) => b.asset === 'USDT');
      const usdtFree = usdtItem ? usdtItem.free_raw : 0;

      if (usdtFree >= quoteOrderSize) {
        const order = await executeMarketBuy(symbol, quoteOrderSize, credentials);
        const boughtQty = parseFloat(order.executedQty || '0');
        const fillPrice = parseFloat(order.fills?.[0]?.price || String(currentPrice));

        if (boughtQty > 0) {
          botState.position_qty = boughtQty.toString();
          botState.last_candle = candleTime;
          const newTrade = {
            id: order.orderId,
            side: 'BUY',
            qty: boughtQty,
            price: fillPrice,
            time: new Date().toLocaleTimeString(),
          };
          botState.trades.unshift(newTrade);
          await persistNewTrade(newTrade);
          await persistBotState({
            position_qty: botState.position_qty,
            last_candle: candleTime,
            last_bg_tick: nowTimeStr,
          });
          // 🔔 Notify
          await sendBuyNotification({
            symbol,
            qty: boughtQty,
            price: fillPrice,
            quoteSpent: quoteOrderSize,
            orderId: order.orderId,
          });
          syncBackgroundState({
            position_qty: botState.position_qty,
            last_candle: candleTime,
          });
        }
      }
    } else if (signal === 'SELL' && botPositionQty > 0) {
      const step = await fetchExchangeStepSize(symbol);
      const sellQty = roundStep(Math.min(botPositionQty, btcFree || botPositionQty), step);

      if (parseFloat(sellQty) > 0) {
        const order = await executeMarketSell(symbol, sellQty, credentials);
        const soldQty = parseFloat(order.executedQty || '0');
        const fillPrice = parseFloat(order.fills?.[0]?.price || String(currentPrice));

        botState.position_qty = '0';
        botState.last_candle = candleTime;
        const newTrade = {
          id: order.orderId,
          side: 'SELL',
          qty: soldQty,
          price: fillPrice,
          time: new Date().toLocaleTimeString(),
        };
        botState.trades.unshift(newTrade);
        await persistNewTrade(newTrade);
        await persistBotState({
          position_qty: '0',
          last_candle: candleTime,
          last_bg_tick: nowTimeStr,
        });
        // 🔔 Notify
        await sendSellNotification({
          symbol,
          qty: soldQty,
          price: fillPrice,
          quoteReceived: soldQty * fillPrice,
          orderId: order.orderId,
        });
        syncBackgroundState({
          position_qty: '0',
          last_candle: candleTime,
        });
      }
    }

    // Update persistent status notification
    await sendBotStatusNotification({
      signal,
      strategyName: strategyName || botState.currentStrategyId,
      interval: botState.interval,
      price: currentPrice,
      positionQty: botState.position_qty,
      lastCheck: nowTimeStr,
      tickCount: botState.bg_tick_count,
    });
  } catch (err) {
    console.warn('[BOT] Automated cycle error:', err.message);
  }
}
