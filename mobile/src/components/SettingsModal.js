import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  fetchAccountBalances,
  DEFAULT_API_KEY,
  DEFAULT_API_SECRET,
} from '../services/binanceExchange.js';
import {
  getBotState,
  updateBotCredentials,
  setEngineRunning,
} from '../services/tradingBotManager.js';

export default function SettingsModal({ visible, onClose, onRefreshData }) {
  const currentBotState = getBotState();
  const [apiKey, setApiKey] = useState(currentBotState.credentials.apiKey);
  const [apiSecret, setApiSecret] = useState(currentBotState.credentials.apiSecret);
  const [isEngineOn, setIsEngineOn] = useState(currentBotState.isEngineRunning);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (visible) {
      const state = getBotState();
      setApiKey(state.credentials.apiKey || DEFAULT_API_KEY);
      setApiSecret(state.credentials.apiSecret || DEFAULT_API_SECRET);
      setIsEngineOn(state.isEngineRunning);
      setTestResult(null);
    }
  }, [visible]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetchAccountBalances({ apiKey, apiSecret });
      setIsTesting(false);
      setTestResult({
        ok: true,
        message: `Connected to Binance Testnet! Account has ${res.balances.length} assets.`,
      });
    } catch (err) {
      setIsTesting(false);
      setTestResult({
        ok: false,
        message: err.message || 'Connection to Binance failed',
      });
    }
  };

  const handleSave = async () => {
    await updateBotCredentials(apiKey, apiSecret);
    await setEngineRunning(isEngineOn);
    if (onRefreshData) onRefreshData();
    onClose();
  };

  const handleOpenAppSettings = () => {
    if (Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="settings-sharp" size={18} color={COLORS.primary} />
                <Text style={styles.title}>Exchange & Bot Settings</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.description}>
                This app connects directly to the <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Binance Spot Testnet API</Text> without any intermediate Python server.
              </Text>

              {/* Bot Auto Execution Toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Automated Strategy Engine</Text>
                  <Text style={styles.toggleDesc}>
                    Execute MA 20/50 buy/sell trades autonomously on mobile
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    { backgroundColor: isEngineOn ? COLORS.success : COLORS.cardBorder }
                  ]}
                  onPress={() => setIsEngineOn(!isEngineOn)}
                >
                  <Text style={styles.toggleBtnText}>{isEngineOn ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              {/* API Key */}
              <Text style={styles.inputLabel}>BINANCE API KEY</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="key-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={apiKey}
                  onChangeText={(text) => {
                    setApiKey(text);
                    setTestResult(null);
                  }}
                  placeholder="Enter API Key"
                  placeholderTextColor={COLORS.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* API Secret */}
              <Text style={styles.inputLabel}>BINANCE API SECRET</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  value={apiSecret}
                  onChangeText={(text) => {
                    setApiSecret(text);
                    setTestResult(null);
                  }}
                  placeholder="Enter API Secret"
                  placeholderTextColor={COLORS.textDim}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Reset to Default Testnet Keys */}
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => {
                  setApiKey(DEFAULT_API_KEY);
                  setApiSecret(DEFAULT_API_SECRET);
                  setTestResult(null);
                }}
              >
                <Ionicons name="refresh-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.resetText}>Reset to Default Demo Testnet Keys</Text>
              </TouchableOpacity>

              {/* Test status banner */}
              {testResult && (
                <View
                  style={[
                    styles.testStatus,
                    { backgroundColor: testResult.ok ? COLORS.successGlow : COLORS.dangerGlow },
                  ]}
                >
                  <Ionicons
                    name={testResult.ok ? 'checkmark-circle' : 'alert-circle'}
                    size={16}
                    color={testResult.ok ? COLORS.success : COLORS.danger}
                  />
                  <Text
                    style={[
                      styles.testStatusText,
                      { color: testResult.ok ? COLORS.success : COLORS.danger },
                    ]}
                  >
                    {testResult.message}
                  </Text>
                </View>
              )}

              {/* 24/7 Background Trading Setup (Android) */}
              <View style={styles.bgGuideBox}>
                <View style={styles.bgGuideHeader}>
                  <Ionicons name="infinite-outline" size={17} color={COLORS.primary} />
                  <Text style={styles.bgGuideTitle}>24/7 Background Engine</Text>
                </View>
                <Text style={styles.bgGuideText}>
                  To ensure the bot continues evaluating strategies and executing trades even when this app is closed or terminated:
                </Text>
                <View style={styles.bgGuideStep}>
                  <Ionicons name="battery-charging-outline" size={14} color={COLORS.warning} />
                  <Text style={styles.bgGuideStepText}>
                    Set Battery Optimization to <Text style={{ color: COLORS.success, fontWeight: '700' }}>Unrestricted</Text> so Android never sleeps the engine.
                  </Text>
                </View>
                <View style={styles.bgGuideStep}>
                  <Ionicons name="notifications-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.bgGuideStepText}>
                    Keep Notifications enabled to receive instant BUY/SELL execution alerts.
                  </Text>
                </View>
                <View style={styles.bgGuideStep}>
                  <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.bgGuideStepText}>
                    (Samsung / Xiaomi) In App Switcher, tap the lock icon to prevent system auto-kill.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.batteryBtn}
                  onPress={handleOpenAppSettings}
                  activeOpacity={0.7}
                >
                  <Ionicons name="settings-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.batteryBtnText}>Open Device App Settings</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.testBtn]}
                  onPress={handleTest}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color={COLORS.textPrimary} />
                  ) : (
                    <Text style={styles.testBtnText}>Test Direct API</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save & Apply</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  toggleDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 16,
  },
  resetText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  testStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  testStatusText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtn: {
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bgGuideBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bgGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bgGuideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bgGuideText: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
    marginBottom: 10,
  },
  bgGuideStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bgGuideStepText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 15,
  },
  batteryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardElevated,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 8,
  },
  batteryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
