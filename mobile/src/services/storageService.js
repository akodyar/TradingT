import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_KEY, DEFAULT_API_SECRET } from './binanceExchange.js';

const STORAGE_KEYS = {
  CREDENTIALS: '@trading_bot_credentials',
  CONFIG: '@trading_bot_config',
  STATE: '@trading_bot_state',
  TRADES: '@trading_bot_trades',
};

export const DEFAULT_BOT_STATE = {
  isEngineRunning: true,
  currentStrategyId: 'DUAL_MA',
  position_qty: '0',
  last_candle: null,
  symbol: 'BTCUSDT',
  interval: '1m',
  quoteOrderSize: '20',
  trades: [],
  credentials: {
    apiKey: DEFAULT_API_KEY,
    apiSecret: DEFAULT_API_SECRET,
  },
};

/**
 * Load complete bot state and configuration from persistent storage.
 * Used at app launch and by headless background tasks.
 */
export async function loadBotStateFromStorage() {
  try {
    const [rawCreds, rawConfig, rawState, rawTrades] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.CREDENTIALS),
      AsyncStorage.getItem(STORAGE_KEYS.CONFIG),
      AsyncStorage.getItem(STORAGE_KEYS.STATE),
      AsyncStorage.getItem(STORAGE_KEYS.TRADES),
    ]);

    const credentials = rawCreds
      ? JSON.parse(rawCreds)
      : { apiKey: DEFAULT_API_KEY, apiSecret: DEFAULT_API_SECRET };

    const config = rawConfig ? JSON.parse(rawConfig) : {};
    const state = rawState ? JSON.parse(rawState) : {};
    const trades = rawTrades ? JSON.parse(rawTrades) : [];

    return {
      ...DEFAULT_BOT_STATE,
      ...config,
      ...state,
      trades: Array.isArray(trades) ? trades : [],
      credentials: {
        apiKey: credentials.apiKey || DEFAULT_API_KEY,
        apiSecret: credentials.apiSecret || DEFAULT_API_SECRET,
      },
    };
  } catch (err) {
    console.warn('[Storage] Error loading bot state:', err.message);
    return { ...DEFAULT_BOT_STATE };
  }
}

/**
 * Persist bot credentials (API key & secret) to device disk
 */
export async function persistBotCredentials(credentials) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CREDENTIALS,
      JSON.stringify({
        apiKey: credentials?.apiKey || DEFAULT_API_KEY,
        apiSecret: credentials?.apiSecret || DEFAULT_API_SECRET,
      })
    );
  } catch (err) {
    console.warn('[Storage] Error saving credentials:', err.message);
  }
}

/**
 * Persist bot engine configuration (strategy, symbol, order size, active state)
 */
export async function persistBotConfig(config) {
  try {
    const toSave = {
      isEngineRunning: config.isEngineRunning ?? true,
      currentStrategyId: config.currentStrategyId || 'DUAL_MA',
      symbol: config.symbol || 'BTCUSDT',
      interval: config.interval || '1m',
      quoteOrderSize: config.quoteOrderSize || '20',
    };
    await AsyncStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(toSave));
  } catch (err) {
    console.warn('[Storage] Error saving config:', err.message);
  }
}

/**
 * Persist active position quantity and last closed candle timestamp
 */
export async function persistBotState(state) {
  try {
    const toSave = {
      position_qty: state.position_qty ?? '0',
      last_candle: state.last_candle ?? null,
    };
    await AsyncStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(toSave));
  } catch (err) {
    console.warn('[Storage] Error saving state:', err.message);
  }
}

/**
 * Append a newly executed trade to persistent storage
 */
export async function persistNewTrade(trade) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.TRADES);
    const trades = raw ? JSON.parse(raw) : [];
    trades.unshift(trade);
    // Keep last 100 trades
    const trimmed = trades.slice(0, 100);
    await AsyncStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.warn('[Storage] Error recording trade:', err.message);
    return [];
  }
}

/**
 * Clear trade history
 */
export async function clearPersistentTrades() {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.TRADES);
  } catch (err) {
    console.warn('[Storage] Error clearing trades:', err.message);
  }
}

