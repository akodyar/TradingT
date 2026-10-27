import CryptoJS from 'crypto-js';

export const BINANCE_DEMO_BASE_URL = 'https://testnet.binance.vision/api';

// Default Demo Testnet keys from .env
export const DEFAULT_API_KEY =
  '3vIKjkqJy2j6WCgjCResdeQ3dqwOfIFlKSYyCiqRSbSKswncgMWDFFQ0nVkU9Pio';
export const DEFAULT_API_SECRET =
  'wWLkMssqQHhKfuvou4i2CBmk5Oy4wTwsyJMfEube4EIESnPYyGXOUZvLlIUreU19';

let timeOffset = 0;
let lastTimeSync = 0;

/**
 * Synchronize local device timestamp with Binance server time
 */
export async function syncServerTime(baseUrl = BINANCE_DEMO_BASE_URL) {
  // Sync if never synced or older than 5 minutes
  if (Date.now() - lastTimeSync < 300000 && lastTimeSync > 0) {
    return timeOffset;
  }

  try {
    const res = await fetch(`${baseUrl}/v3/time`);
    if (!res.ok) throw new Error(`Time sync failed HTTP ${res.status}`);
    const data = await res.json();
    timeOffset = Number(data.serverTime) - Date.now();
    lastTimeSync = Date.now();
    return timeOffset;
  } catch (err) {
    console.warn('Could not sync Binance server time, using local:', err.message);
    return timeOffset;
  }
}

/**
 * Perform a signed API request directly from the mobile app to Binance
 */
export async function signedBinanceRequest({
  endpoint,
  method = 'GET',
  params = {},
  apiKey = DEFAULT_API_KEY,
  apiSecret = DEFAULT_API_SECRET,
  baseUrl = BINANCE_DEMO_BASE_URL,
}) {
  await syncServerTime(baseUrl);

  const timestamp = Date.now() + timeOffset;
  const mergedParams = {
    ...params,
    timestamp: timestamp.toString(),
    recvWindow: '5000',
  };

  const queryString = Object.keys(mergedParams)
    .filter((k) => mergedParams[k] !== undefined && mergedParams[k] !== null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(mergedParams[k])}`)
    .join('&');

  const signature = CryptoJS.HmacSHA256(queryString, apiSecret).toString(
    CryptoJS.enc.Hex
  );

  const fullQuery = `${queryString}&signature=${signature}`;
  let url = `${baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  };

  if (method === 'GET' || method === 'DELETE') {
    url += (url.includes('?') ? '&' : '?') + fullQuery;
  } else {
    options.body = fullQuery;
  }

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.msg || `Binance API Error HTTP ${res.status}`);
  }

  return data;
}

/**
 * Public unsigned request (ticker, klines, server time)
 */
export async function publicBinanceRequest({
  endpoint,
  params = {},
  baseUrl = BINANCE_DEMO_BASE_URL,
}) {
  const queryString = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const url = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.msg || `Binance API Error HTTP ${res.status}`);
  }

  return data;
}

// -------------------------------------------------------------
// Binance Core Methods
// -------------------------------------------------------------

export async function fetchAccountBalances(credentials = {}) {
  const apiKey = credentials.apiKey || DEFAULT_API_KEY;
  const apiSecret = credentials.apiSecret || DEFAULT_API_SECRET;

  return signedBinanceRequest({
    endpoint: '/v3/account',
    method: 'GET',
    apiKey,
    apiSecret,
  });
}

export async function fetchTicker24hr(symbol = 'BTCUSDT') {
  return publicBinanceRequest({
    endpoint: '/v3/ticker/24hr',
    params: { symbol },
  });
}

export async function fetchTickerPrice(symbol = 'BTCUSDT') {
  return publicBinanceRequest({
    endpoint: '/v3/ticker/price',
    params: { symbol },
  });
}

export async function fetchCandles(symbol = 'BTCUSDT', interval = '1h', limit = 60) {
  return publicBinanceRequest({
    endpoint: '/v3/klines',
    params: { symbol, interval, limit },
  });
}

export async function fetchExchangeStepSize(symbol = 'BTCUSDT') {
  const info = await publicBinanceRequest({
    endpoint: '/v3/exchangeInfo',
    params: { symbol },
  });

  const symbolData = info.symbols && info.symbols[0];
  if (!symbolData) return 0.00001;

  const lotFilter = symbolData.filters.find((f) => f.filterType === 'LOT_SIZE');
  return lotFilter ? parseFloat(lotFilter.stepSize) : 0.00001;
}

export function roundStep(quantity, step) {
  const q = parseFloat(quantity);
  const s = parseFloat(step);
  if (isNaN(q) || isNaN(s) || s <= 0) return quantity.toString();
  const factor = Math.floor(q / s);
  const decimals = (s.toString().split('.')[1] || '').length;
  return (factor * s).toFixed(decimals);
}

export async function executeMarketBuy(symbol, quoteOrderQty, credentials = {}) {
  const apiKey = credentials.apiKey || DEFAULT_API_KEY;
  const apiSecret = credentials.apiSecret || DEFAULT_API_SECRET;

  return signedBinanceRequest({
    endpoint: '/v3/order',
    method: 'POST',
    params: {
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: quoteOrderQty.toString(),
      newOrderRespType: 'FULL',
    },
    apiKey,
    apiSecret,
  });
}

export async function executeMarketSell(symbol, quantity, credentials = {}) {
  const apiKey = credentials.apiKey || DEFAULT_API_KEY;
  const apiSecret = credentials.apiSecret || DEFAULT_API_SECRET;

  return signedBinanceRequest({
    endpoint: '/v3/order',
    method: 'POST',
    params: {
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: quantity.toString(),
      newOrderRespType: 'FULL',
    },
    apiKey,
    apiSecret,
  });
}
