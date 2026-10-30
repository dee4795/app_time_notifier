// App.js — App Time Notifier
// Main screen: shows monitored apps, lets user add/remove them, set time limits.
// All data is saved on the phone using AsyncStorage (no server needed).

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Modal, FlatList, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Try to load our native module that reads ALL installed apps from Android ──
// If the native module is not compiled yet, we fall back to the curated list.
// This pattern is called "graceful degradation" — the app still works even if
// a feature is missing, just with fewer options.
let nativeGetInstalledApps = null;
try {
  const mod = require('app-list-reader');
  nativeGetInstalledApps = mod.getInstalledApps;
} catch (_) {
  nativeGetInstalledApps = null; // native module not linked yet — use fallback
}

// ── Curated list of popular apps ──
// These cover 90%+ of what users want to limit.
// We include popular Indian apps too (ShareChat, Moj, Josh etc.)
const POPULAR_APPS = [
  { appName: 'Instagram',    packageName: 'com.instagram.android',           emoji: '📸' },
  { appName: 'YouTube',      packageName: 'com.google.android.youtube',       emoji: '▶️' },
  { appName: 'TikTok',       packageName: 'com.zhiliaoapp.musically',         emoji: '🎵' },
  { appName: 'Facebook',     packageName: 'com.facebook.katana',              emoji: '👍' },
  { appName: 'Twitter / X',  packageName: 'com.twitter.android',              emoji: '🐦' },
  { appName: 'WhatsApp',     packageName: 'com.whatsapp',                     emoji: '💬' },
  { appName: 'Snapchat',     packageName: 'com.snapchat.android',             emoji: '👻' },
  { appName: 'Reddit',       packageName: 'com.reddit.frontpage',             emoji: '🤖' },
  { appName: 'Netflix',      packageName: 'com.netflix.mediaclient',          emoji: '🎬' },
  { appName: 'Amazon Prime', packageName: 'com.amazon.avod.thirdpartyclient', emoji: '📦' },
  { appName: 'Telegram',     packageName: 'org.telegram.messenger',           emoji: '✈️' },
  { appName: 'LinkedIn',     packageName: 'com.linkedin.android',             emoji: '💼' },
  { appName: 'Pinterest',    packageName: 'com.pinterest',                    emoji: '📌' },
  { appName: 'Spotify',      packageName: 'com.spotify.music',                emoji: '🎧' },
  { appName: 'Twitch',       packageName: 'tv.twitch.android.app',            emoji: '🎮' },
  { appName: 'Discord',      packageName: 'com.discord',                      emoji: '🕹️' },
  // Indian apps
  { appName: 'ShareChat',    packageName: 'in.mohalla.sharechat',             emoji: '🇮🇳' },
  { appName: 'Moj',          packageName: 'in.mohalla.video',                 emoji: '🎭' },
  { appName: 'Josh',         packageName: 'com.sharechat.josh',               emoji: '🎪' },
  { appName: 'Roposo',       packageName: 'com.roposo.android',               emoji: '🎬' },
  { appName: 'MX TakaTak',   packageName: 'com.mxtakatak',                   emoji: '📱' },
  { appName: 'Meesho',       packageName: 'com.meesho.supply',                emoji: '🛍️' },
  { appName: 'Flipkart',     packageName: 'com.flipkart.android',             emoji: '🛒' },
];

// ── Time limit options ──
const TIME_LIMITS = [
  { label: '15 min',  value: 15  },
  { label: '30 min',  value: 30  },
  { label: '1 hour',  value: 60  },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
];

const STORAGE_KEY = 'monitored_apps_v1';

// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [monitoredApps,    setMonitoredApps]    = useState([]);  // saved apps list
  const [isPickerOpen,     setIsPickerOpen]     = useState(false); // app picker modal
  const [isLimitOpen,      setIsLimitOpen]      = useState(false); // time limit modal
  const [pickerApps,       setPickerApps]       = useState([]);  // list shown in picker
  const [isLoadingApps,    setIsLoadingApps]    = useState(false);
  const [selectedApp,      setSelectedApp]      = useState(null); // app tapped in picker
  const [selectedLimit,    setSelectedLimit]    = useState(30);   // minutes
  const [message,          setMessage]          = useState('');   // notification text
  const [searchQuery,      setSearchQuery]      = useState('');
  const [showCustom,       setShowCustom]       = useState(false);
  const [customName,       setCustomName]       = useState('');
  const [usingNativeList,  setUsingNativeList]  = useState(false); // true = native module worked

  // Load saved data when app starts
  useEffect(() => { loadSaved(); }, []);

  const loadSaved = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) setMonitoredApps(JSON.parse(json));
    } catch (e) { console.error(e); }
  };

  const saveAll = async (list) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { console.error(e); }
  };

  // ── Open the picker modal ──
  const openPicker = async () => {
    setSearchQuery('');
    setShowCustom(false);
    setCustomName('');
    setIsPickerOpen(true);

    if (nativeGetInstalledApps) {
      // Native module is available — load ALL apps from the phone!
      setIsLoadingApps(true);
      try {
        const apps = await nativeGetInstalledApps();
        // Map native result to same shape as POPULAR_APPS
        setPickerApps(apps.map(a => ({ ...a, emoji: '📱' })));
        setUsingNativeList(true);
      } catch (e) {
        console.warn('Native app list failed, using curated list:', e);
        setPickerApps(POPULAR_APPS);
        setUsingNativeList(false);
      } finally {
        setIsLoadingApps(false);
      }
    } else {
      // Native module not linked yet — use the curated list
      setPickerApps(POPULAR_APPS);
      setUsingNativeList(false);
    }
  };

  // ── App tapped in the picker ──
  const onAppTapped = (app) => {
    if (monitoredApps.some(m => m.packageName === app.packageName)) {
      Alert.alert('Already added', `${app.appName} is already in your list.`);
      return;
    }
    setSelectedApp(app);
    setIsPickerOpen(false);
    setSelectedLimit(30);
    setMessage('');
    setIsLimitOpen(true);
  };

  // ── "Other app" confirm ──
  const onCustomConfirm = () => {
    const name = customName.trim();
    if (!name) { Alert.alert('Name required', 'Please type the app name.'); return; }
    onAppTapped({ appName: name, packageName: `custom.${name.toLowerCase().replace(/\s+/g, '.')}`, emoji: '📱' });
  };

  // ── Save the limit ──
  const onSave = async () => {
    if (!message.trim()) {
      Alert.alert('Message needed', 'Please type your notification message.');
      return;
    }
    const entry = {
      appName:      selectedApp.appName,
      packageName:  selectedApp.packageName,
      emoji:        selectedApp.emoji || '📱',
      limitMinutes: selectedLimit,
      message:      message.trim(),
    };
    const updated = [...monitoredApps, entry];
    setMonitoredApps(updated);
    await saveAll(updated);
    setIsLimitOpen(false);
    setSelectedApp(null);
  };

  // ── Delete an app card ──
  const onDelete = (pkg) => {
    Alert.alert('Remove app', 'Stop monitoring this app?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = monitoredApps.filter(a => a.packageName !== pkg);
        setMonitoredApps(updated);
        await saveAll(updated);
      }},
    ]);
  };

  const filtered = pickerApps.filter(a =>
    a.appName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fmtLimit = (min) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>App Time Notifier</Text>
        <Text style={s.headerSub}>Know when you've had enough</Text>
      </View>

      {/* ── Home screen content ── */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {monitoredApps.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📱</Text>
            <Text style={s.emptyTitle}>No apps monitored yet</Text>
            <Text style={s.emptyText}>
              Tap the button below to pick an app and set a daily time limit.
              When you reach the limit, we will send you a gentle notification.
            </Text>
          </View>
        ) : (
          monitoredApps.map(app => (
            <View key={app.packageName} style={s.card}>
              <Text style={s.cardEmoji}>{app.emoji}</Text>
              <View style={s.cardInfo}>
                <Text style={s.cardName}>{app.appName}</Text>
                <Text style={s.cardLimit}>Daily limit: {fmtLimit(app.limitMinutes)}</Text>
                <Text style={s.cardMsg} numberOfLines={1}>"{app.message}"</Text>
              </View>
              <TouchableOpacity onPress={() => onDelete(app.packageName)} style={s.delBtn}>
                <Text style={s.delBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity style={s.addBtn} onPress={openPicker}>
          <Text style={s.addBtnTxt}>+ Add App to Monitor</Text>
        </TouchableOpacity>

        <Text style={s.note}>
          💡 Background tracking and notifications coming in the next update.
        </Text>
      </ScrollView>

      {/* ══════════════════════════════════════════
          APP PICKER MODAL
          Shows installed apps from phone (native) or curated list (fallback).
      ══════════════════════════════════════════ */}
      <Modal visible={isPickerOpen} animationType="slide" onRequestClose={() => setIsPickerOpen(false)}>
        <SafeAreaView style={s.modalArea}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle}>Choose an App</Text>
            <TouchableOpacity onPress={() => setIsPickerOpen(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Source badge */}
          <View style={s.sourceBadge}>
            <Text style={s.sourceTxt}>
              {usingNativeList
                ? `📱 Showing all apps on your phone`
                : `⭐ Showing popular apps — tap "Other" to add any app`}
            </Text>
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Text>🔍  </Text>
            <TextInput
              style={s.searchInput} placeholder="Search..." placeholderTextColor="#777"
              value={searchQuery} onChangeText={setSearchQuery}
            />
          </View>

          {isLoadingApps ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={s.loadingTxt}>Reading apps on your phone...</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => item.packageName}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.listItem} onPress={() => onAppTapped(item)}>
                  <Text style={s.listEmoji}>{item.emoji}</Text>
                  <View style={s.listInfo}>
                    <Text style={s.listName}>{item.appName}</Text>
                    {/* Show package name so user knows what's being tracked */}
                    <Text style={s.listPkg} numberOfLines={1}>{item.packageName}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListFooterComponent={
                <View>
                  {/* "Other app" option — user types any name */}
                  <TouchableOpacity
                    style={[s.listItem, s.otherRow]}
                    onPress={() => setShowCustom(!showCustom)}
                  >
                    <Text style={s.listEmoji}>➕</Text>
                    <Text style={[s.listName, { color: ACCENT }]}>Other app not in list</Text>
                  </TouchableOpacity>
                  {showCustom && (
                    <View style={s.customBox}>
                      <TextInput
                        style={s.customInput}
                        placeholder="Type the app name (e.g. Clash of Clans)"
                        placeholderTextColor="#777"
                        value={customName} onChangeText={setCustomName}
                      />
                      <TouchableOpacity style={s.customBtn} onPress={onCustomConfirm}>
                        <Text style={s.customBtnTxt}>Next →</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <View style={{ height: 40 }} />
                </View>
              }
              ListEmptyComponent={
                <Text style={s.noResults}>No apps found for "{searchQuery}"</Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════
          TIME LIMIT MODAL
          User picks daily limit + types their message.
      ══════════════════════════════════════════ */}
      <Modal visible={isLimitOpen} animationType="slide" onRequestClose={() => setIsLimitOpen(false)}>
        <SafeAreaView style={s.modalArea}>
          <View style={s.modalHdr}>
            <Text style={s.modalTitle}>
              {selectedApp ? `${selectedApp.emoji}  ${selectedApp.appName}` : ''}
            </Text>
            <TouchableOpacity onPress={() => setIsLimitOpen(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.limitScroll}>
            <Text style={s.secLabel}>Daily Time Limit</Text>
            <Text style={s.secHint}>You will get a notification when you reach this limit.</Text>
            <View style={s.chips}>
              {TIME_LIMITS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.chip, selectedLimit === opt.value && s.chipOn]}
                  onPress={() => setSelectedLimit(opt.value)}
                >
                  <Text style={[s.chipTxt, selectedLimit === opt.value && s.chipTxtOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.secLabel}>Your Notification Message</Text>
            <Text style={s.secHint}>
              Write something personal — this is what you will see when the limit is reached.
            </Text>
            <TextInput
              style={s.msgInput}
              placeholder={'"Stop scrolling — go do something meaningful!"'}
              placeholderTextColor="#777"
              value={message} onChangeText={setMessage}
              multiline maxLength={200}
            />
            <Text style={s.charCount}>{message.length}/200</Text>

            <TouchableOpacity style={s.saveBtn} onPress={onSave}>
              <Text style={s.saveBtnTxt}>Save ✓</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Design tokens ──
const DARK   = '#1a1a2e';
const CARD   = '#16213e';
const ACCENT = '#e94560';
const WHITE  = '#ffffff';
const DIM    = '#a8a8b3';

const s = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: DARK },

  header:    { backgroundColor: CARD, paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20, elevation: 4 },
  headerTitle:{ fontSize: 24, fontWeight: 'bold', color: ACCENT, letterSpacing: 1 },
  headerSub: { fontSize: 13, color: DIM, marginTop: 4 },

  scroll:       { flex: 1 },
  scrollContent:{ padding: 20, paddingBottom: 40 },

  empty:     { alignItems: 'center', marginTop: 60, marginBottom: 40, padding: 20 },
  emptyEmoji:{ fontSize: 60, marginBottom: 16 },
  emptyTitle:{ fontSize: 20, fontWeight: 'bold', color: WHITE, marginBottom: 12 },
  emptyText: { fontSize: 14, color: DIM, textAlign: 'center', lineHeight: 22 },

  card:     { backgroundColor: CARD, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  cardEmoji:{ fontSize: 36, marginRight: 14 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, color: WHITE, fontWeight: '600' },
  cardLimit:{ fontSize: 13, color: ACCENT, marginTop: 2 },
  cardMsg:  { fontSize: 12, color: DIM, marginTop: 2, fontStyle: 'italic' },
  delBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a1a2e', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  delBtnTxt:{ color: ACCENT, fontSize: 14, fontWeight: 'bold' },

  addBtn:   { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, elevation: 3 },
  addBtnTxt:{ color: WHITE, fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  note:     { color: DIM, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },

  // Modal
  modalArea:{ flex: 1, backgroundColor: DARK },
  modalHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: CARD, elevation: 4 },
  modalTitle:{ fontSize: 18, fontWeight: 'bold', color: WHITE },
  modalClose:{ fontSize: 22, color: DIM, paddingHorizontal: 4 },

  sourceBadge:{ backgroundColor: '#0f3460', paddingHorizontal: 16, paddingVertical: 8 },
  sourceTxt:  { color: DIM, fontSize: 12, textAlign: 'center' },

  searchBar:  { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD, margin: 16, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:{ flex: 1, color: WHITE, fontSize: 15 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 16 },
  loadingTxt: { color: DIM, fontSize: 15 },

  listItem:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CARD },
  listEmoji: { fontSize: 26, marginRight: 16, width: 34, textAlign: 'center' },
  listInfo:  { flex: 1 },
  listName:  { fontSize: 15, color: WHITE },
  listPkg:   { fontSize: 11, color: DIM, marginTop: 2 },
  otherRow:  { borderTopWidth: 1, borderTopColor: '#2a2a4e', marginTop: 8 },

  customBox: { backgroundColor: CARD, padding: 16, marginHorizontal: 16, borderRadius: 10, marginBottom: 8 },
  customInput:{ backgroundColor: '#0f3460', borderRadius: 8, padding: 12, color: WHITE, fontSize: 15, marginBottom: 12 },
  customBtn:  { backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  customBtnTxt:{ color: WHITE, fontWeight: 'bold', fontSize: 15 },

  noResults: { color: DIM, textAlign: 'center', marginTop: 40, fontSize: 15 },

  // Limit modal
  limitScroll:{ flex: 1, padding: 20 },
  secLabel:   { fontSize: 16, fontWeight: 'bold', color: WHITE, marginTop: 20, marginBottom: 6 },
  secHint:    { fontSize: 13, color: DIM, marginBottom: 14, lineHeight: 18 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip:       { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#3a3a5e', backgroundColor: CARD },
  chipOn:     { borderColor: ACCENT, backgroundColor: '#2a1020' },
  chipTxt:    { color: DIM, fontSize: 14 },
  chipTxtOn:  { color: ACCENT, fontWeight: 'bold' },

  msgInput:  { backgroundColor: CARD, borderRadius: 10, padding: 14, color: WHITE, fontSize: 14, lineHeight: 22, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#3a3a5e' },
  charCount: { color: DIM, fontSize: 11, textAlign: 'right', marginTop: 4 },

  saveBtn:   { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 28, elevation: 3 },
  saveBtnTxt:{ color: WHITE, fontSize: 16, fontWeight: 'bold' },
});
