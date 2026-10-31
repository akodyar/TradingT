import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions from the OS.
 * Must be called once at app startup.
 */
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    // Emulators don't support push notifications
    return false;
  }

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

  // Android channel setup
  if (Platform.OS === 'android') {
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
      name: 'Bot Status',
      description: 'Background engine status updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: false,
      showBadge: false,
    });
  }

  return true;
}

/**
 * Send a BUY trade notification
 */
export async function sendBuyNotification({ symbol, qty, price, quoteSpent, orderId }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🟢 BUY ORDER EXECUTED',
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
}

/**
 * Send a SELL trade notification
 */
export async function sendSellNotification({ symbol, qty, price, quoteReceived, orderId }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔴 SELL ORDER EXECUTED',
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
}

/**
 * Send a background engine heartbeat / status notification
 */
export async function sendBotStatusNotification({ signal, strategyName, lastCheck }) {
  const signalEmoji = signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '🟡';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${signalEmoji} Bot 24/7 Active — Signal: ${signal}`,
      body: `Strategy: ${strategyName} · Last evaluated: ${lastCheck}`,
      data: { type: 'STATUS', signal },
      sound: false,
      badge: 0,
      sticky: true,
      autoDismiss: false,
    },
    trigger: null,
    identifier: 'bot-heartbeat',
    channelId: 'bot-status',
  });
}

/**
 * Send an error notification
 */
export async function sendErrorNotification({ message }) {
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
}
