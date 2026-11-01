import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification?.request?.content?.data?.type;
    // Don't pop up intrusive heads-up alert banner for silent heartbeat updates while in foreground
    if (type === 'STATUS') {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

/**
 * Ensure Android notification channels exist (safe to call from headless background task).
 */
export async function ensureNotificationChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('trading-alerts', {
        name: 'Trading Alerts',
        description: 'Real-time buy and sell trade execution alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
        sound: true,
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('bot-status', {
        name: '24/7 Engine Live Status',
        description: 'Persistent background engine heartbeat and signal monitor',
        importance: Notifications.AndroidImportance.LOW,
        sound: false,
        enableVibrate: false,
        showBadge: false,
      });
    } catch (err) {
      console.warn('[Notifications] Channel setup warning:', err.message);
    }
  }
}

/**
 * Request notification permissions from the OS.
 * Works on both physical devices and emulators for local notifications.
 */
export async function requestNotificationPermissions() {
  try {
    await ensureNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted');
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[Notifications] Permission request error:', err.message);
    return false;
  }
}

/**
 * Send a BUY trade notification
 */
export async function sendBuyNotification({ symbol, qty, price, quoteSpent, orderId }) {
  try {
    await ensureNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🟢 BUY ORDER EXECUTED (24/7 Bot)',
        body: `Bought ${parseFloat(qty).toFixed(6)} ${symbol.replace('USDT', '')} @ $${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2 })} · Spent $${parseFloat(quoteSpent || 0).toFixed(2)} USDT`,
        data: { type: 'BUY', symbol, qty, price, orderId },
        sound: true,
        badge: 1,
        color: '#10B981',
      },
      trigger: null, // immediate
      identifier: `buy-${orderId || Date.now()}`,
      channelId: 'trading-alerts',
    });
  } catch (err) {
    console.warn('[Notifications] Buy notification error:', err.message);
  }
}

/**
 * Send a SELL trade notification
 */
export async function sendSellNotification({ symbol, qty, price, quoteReceived, orderId }) {
  try {
    await ensureNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔴 SELL ORDER EXECUTED (24/7 Bot)',
        body: `Sold ${parseFloat(qty).toFixed(6)} ${symbol.replace('USDT', '')} @ $${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2 })} · Received $${parseFloat(quoteReceived || 0).toFixed(2)} USDT`,
        data: { type: 'SELL', symbol, qty, price, orderId },
        sound: true,
        badge: 1,
        color: '#EF4444',
      },
      trigger: null,
      identifier: `sell-${orderId || Date.now()}`,
      channelId: 'trading-alerts',
    });
  } catch (err) {
    console.warn('[Notifications] Sell notification error:', err.message);
  }
}

/**
 * Update the persistent 24/7 background engine heartbeat notification
 */
export async function sendBotStatusNotification({
  signal,
  strategyName,
  interval = '1m',
  price,
  positionQty,
  lastCheck,
  tickCount,
}) {
  try {
    await ensureNotificationChannels();
    const signalEmoji = signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '🟡';
    const priceText = price
      ? ` · BTC $${Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      : '';
    const posNum = parseFloat(positionQty || '0');
    const posText = posNum > 0 ? `${posNum.toFixed(5)} BTC` : 'USDT Ready';
    const tickText = tickCount ? ` (#${tickCount})` : '';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${signalEmoji} 24/7 Bot Active · ${signal}${priceText}`,
        body: `${strategyName} (${interval}) · Pos: ${posText} · Checked ${lastCheck}${tickText}`,
        data: { type: 'STATUS', signal, price, lastCheck },
        sound: false,
        badge: 0,
        sticky: true,
        autoDismiss: false,
        color: '#3B82F6',
      },
      trigger: null,
      identifier: 'bot-heartbeat',
      channelId: 'bot-status',
    });
  } catch (err) {
    console.warn('[Notifications] Status notification error:', err.message);
  }
}

/**
 * Send an error notification
 */
export async function sendErrorNotification({ message }) {
  try {
    await ensureNotificationChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Trading Bot Error',
        body: message || 'An error occurred in the background engine.',
        data: { type: 'ERROR' },
        sound: true,
      },
      trigger: null,
      identifier: `error-${Date.now()}`,
      channelId: 'trading-alerts',
    });
  } catch (err) {
    console.warn('[Notifications] Error notification failed:', err.message);
  }
}
