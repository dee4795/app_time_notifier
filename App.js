// App.js — App Time Notifier
// Main screen: shows monitored apps, lets user add/remove them, set time limits.
// All data is saved on the phone using AsyncStorage (no server needed).
//
// M2.2 changes (design update):
//  1. Safe area fix: content no longer hides under the camera notch,
//     status bar, or bottom navigation bar.
//  2. Calm colour theme (soft blue-slate + mint).
//  3. Smooth animations using React Native's built-in Animated API
//     (no extra animation library, so the app stays small and simple).
//
// M5 changes (reliability + debug screen):
// 11. Debug screen (visible only in development builds via __DEV__).
//     Shows: service running, usage access, notifications, usage minutes.
//     Helps us test and understand what Android is doing.
//  4. Nicer cards, buttons and modals.
//
// M3 changes (usage time):
//  5. Reads how long each monitored app was used today (Usage access).
//  6. Explains Usage access first (required disclosure), then opens Settings.
//  7. Cards show "Used today" with a smooth progress bar.
//
// M4 changes (reminders):
//  8. A background watcher (Kotlin service) checks usage about every 30 seconds.
//  9. When a limit is reached it shows YOUR message + photo as a notification.
// 10. "Send test reminder" button on each card, notification permission banner.

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, Pressable, ScrollView, Modal, FlatList,
  TextInput, ActivityIndicator, Alert, Image, Animated, Easing, LayoutAnimation, AppState, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Asset } from 'expo-asset';
// Why this library: the built-in SafeAreaView does nothing on Android.
// This one gives us the real size of the notch / status bar / nav bar.
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FREE_APP_LIMIT, canAddApp, isAppActiveForPlan } from './planLimits';

// ── Load our native module that reads ALL installed apps from Android ──
let nativeModule = null;
try {
  nativeModule = require('app-list-reader');
} catch (_) {
  nativeModule = null;
}
const nativeGetInstalledApps = nativeModule ? nativeModule.getInstalledApps : null;
// true only if this build already contains the new usage functions
const hasNativeUsage = !!nativeModule && typeof nativeModule.hasUsageAccess === 'function';
// true only if this build already contains the reminder / watcher functions
const hasNativeNotify = !!nativeModule && typeof nativeModule.startWatching === 'function';
// true only if this build has the isWatching function (added in M5)
const hasNativeIsWatching = !!nativeModule && typeof nativeModule.isWatching === 'function';

// ── Quick buttons for common limits. The user can still type any value. ──
const QUICK_LIMITS = [
  { label: '15 min', h: 0, m: 15 },
  { label: '30 min', h: 0, m: 30 },
  { label: '1 hour', h: 1, m: 0 },
  { label: '1h 30m', h: 1, m: 30 },
  { label: '2 hours', h: 2, m: 0 },
];

// ── Message ideas. Soft wellbeing wording, no medical claims. ──
const MESSAGE_IDEAS = [
  'Time for a break. Rest your eyes, stretch your body and drink some water.',
];

// Sample pictures so people can try the reminder without choosing their own photo
const SAMPLE_PHOTOS = [
  { id: 'cat', label: 'Cheeky cat', source: require('./assets/demo-cute-cat.png') },
  { id: 'dog', label: 'Happy puppy', source: require('./assets/demo-happy-dog.jpg') },
  { id: 'nature', label: 'Calm nature', source: require('./assets/demo-calm-nature.jpg') },
  { id: 'tea', label: 'Tea break', source: require('./assets/demo-tea-break.jpg') },
];

const STORAGE_KEY = 'monitored_apps_v1';
const BATTERY_HINT_KEY = 'battery_hint_v1';   // saved once the user taps "Got it"
const PRO_KEY = 'is_pro_v1';                  // "yes" when Pro is on (real payment comes later)

// ── Calm colour palette (all colours live here, so changing the look is easy) ──
const C = {
  bg: '#0F1C24',        // deep blue-slate background
  surface: '#16272F',   // cards
  surface2: '#1D3440',  // icon tiles, inputs
  border: '#26414E',
  mint: '#7FD6C2',      // main soft accent
  mintDark: '#0F2E2B',  // text on mint buttons
  mintTint: '#17352F',  // soft mint background
  text: '#EAF2F3',
  dim: '#8DA4AC',
  softRed: '#E39A9A',
};

// ────────────────────────────────────────────────────────────────────────────
// SMALL ANIMATION HELPERS
// Each one is a tiny component, so the main screen code stays easy to read.
// useNativeDriver: true = the animation runs on the phone's UI thread,
// which keeps it smooth even when JavaScript is busy.
// ────────────────────────────────────────────────────────────────────────────

// Fades in and slides up a little when it first appears.
function FadeInUp({ delay = 0, style, children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration: 500, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[style, {
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

// A button/card that shrinks very slightly when pressed, then springs back.
function PressScale({ onPress, style, wrapStyle, children, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress} disabled={disabled} style={wrapStyle}
      onPressIn={() => to(0.97)} onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Slowly floats up and down — a calm, "breathing" feel for the empty screen.
function Floating({ children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
      {children}
    </Animated.View>
  );
}

// Shows the real app icon if we have it, else an emoji.
function AppIcon({ icon, size = 40 }) {
  if (icon) {
    return (
      <Image
        source={{ uri: `data:image/png;base64,${icon}` }}
        style={{ width: size, height: size, borderRadius: size / 4.5 }}
      />
    );
  }
  return <Text style={{ fontSize: size * 0.7 }}>📱</Text>;
}

// A thin bar that fills smoothly. value goes from 0 (empty) to 1 (full).
// When the limit is reached it turns soft red.
// Note: width cannot use the native driver, so this one runs on the JS side.
function ProgressBar({ value }) {
  const v = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    Animated.timing(v, {
      toValue: clamped, duration: 700,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [clamped]);
  return (
    <View style={s.barTrack}>
      <Animated.View
        style={[
          s.barFill, clamped >= 1 && s.barFillFull,
          { width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MODAL SHELL
// A full-screen sheet with a title bar. It uses the safe-area sizes so the
// title never goes under the camera notch.
// ────────────────────────────────────────────────────────────────────────────
function ModalBody({ title, left, onClose, children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.modalArea, { paddingBottom: insets.bottom }]}>
      <View style={[s.modalHdr, { paddingTop: insets.top + 14 }]}>
        <View style={s.hdrLeft}>
          {left}
          <Text style={s.modalTitle} numberOfLines={1}>{title}</Text>
        </View>
        <Pressable onPress={onClose} style={s.closeBtn} hitSlop={10}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function ModalShell({ visible, onClose, title, left, children }) {
  return (
    <Modal
      visible={visible} animationType="slide" onRequestClose={onClose}
      statusBarTranslucent navigationBarTranslucent
    >
      {/* A Modal is a separate window, so it needs its own provider. */}
      <SafeAreaProvider>
        <ModalBody title={title} left={left} onClose={onClose}>{children}</ModalBody>
      </SafeAreaProvider>
    </Modal>
  );
}

// Deletes a photo file we copied earlier. If it is already gone, that is fine.
const deleteFileQuietly = (uri) => {
  try {
    if (!uri) return;
    if (nativeModule && typeof nativeModule.deletePhoto === 'function') nativeModule.deletePhoto(uri);
    else new File(uri).delete();   // old build without the photo functions
  } catch (_) { /* nothing to delete */ }
};

// Keep only digits and at most 2 characters (so "99" is the biggest).
const onlyDigits = (t) => t.replace(/[^0-9]/g, '').slice(0, 2);

// ────────────────────────────────────────────────────────────────────────────
// DEBUG PANEL — only shown in development builds (__DEV__ === true).
// In a release build __DEV__ is false, so this component and its button
// are stripped out automatically. Normal users never see it.
//
// What it shows:
//   • Is the background watcher service running?
//   • Is Usage access on?
//   • Are notifications allowed?
//   • How many minutes each monitored app was used today?
//   • Today's date key (used to reset reminders at midnight)
// ────────────────────────────────────────────────────────────────────────────
function DebugPanel({ visible, onClose, monitoredApps }) {
  // debugInfo holds all the values we read from Android / AsyncStorage
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch fresh data every time the panel opens
  useEffect(() => {
    if (!visible) return;
    refresh();
  }, [visible]);

  const refresh = async () => {
    setLoading(true);
    try {
      const info = {
        // Service running? (uses the new isWatching function we added in M5)
        serviceRunning: hasNativeIsWatching ? nativeModule.isWatching() : '(not in this build)',
        // Usage access on?
        usageAccess: hasNativeUsage ? nativeModule.hasUsageAccess() : '(not in this build)',
        // Extra detail from Android about usage access (useful for debugging)
        usageDetail: hasNativeUsage ? nativeModule.getUsageAccessDebug() : '',
        // Notifications allowed?
        notifEnabled: hasNativeNotify ? nativeModule.areNotificationsEnabled() : '(not in this build)',
        // Today's key — this is what resets at midnight
        todayKey: new Date().toLocaleDateString('en-CA'), // "2026-11-25" format
        // Usage minutes for each monitored app
        usageMinutes: {},
      };

      if (hasNativeUsage && info.usageAccess && monitoredApps.length > 0) {
        info.usageMinutes = await nativeModule.getTodayUsageMinutes(
          monitoredApps.map(a => a.packageName)
        );
      }

      setDebugInfo(info);
    } catch (e) {
      setDebugInfo({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  // A single row in the debug table
  const Row = ({ label, value, ok }) => (
    <View style={dbg.row}>
      <Text style={dbg.label}>{label}</Text>
      <Text style={[dbg.value, ok === false && dbg.bad, ok === true && dbg.good]}>
        {String(value)}
      </Text>
    </View>
  );

  return (
    <ModalShell visible={visible} onClose={onClose} title="🛠 Debug Panel">
      <ScrollView style={dbg.scroll} contentContainerStyle={{ paddingBottom: 30 }}>
        {loading && (
          <ActivityIndicator size="large" color={C.mint} style={{ marginTop: 30 }} />
        )}

        {debugInfo?.error && (
          <Text style={dbg.error}>{debugInfo.error}</Text>
        )}

        {debugInfo && !debugInfo.error && (
          <>
            <Text style={dbg.section}>System Status</Text>
            <Row
              label="Background service"
              value={debugInfo.serviceRunning ? 'Running ✓' : 'Stopped ✗'}
              ok={debugInfo.serviceRunning === true}
            />
            <Row
              label="Usage access"
              value={debugInfo.usageAccess ? 'Allowed ✓' : 'Denied ✗'}
              ok={debugInfo.usageAccess === true}
            />
            {!!debugInfo.usageDetail && (
              <Row label="Usage detail" value={debugInfo.usageDetail} />
            )}
            <Row
              label="Notifications"
              value={debugInfo.notifEnabled ? 'Allowed ✓' : 'Denied ✗'}
              ok={debugInfo.notifEnabled === true}
            />
            <Row label="Today's reset key" value={debugInfo.todayKey} />

            {monitoredApps.length > 0 && (
              <>
                <Text style={dbg.section}>Today's Usage</Text>
                {monitoredApps.map(app => (
                  <Row
                    key={app.packageName}
                    label={app.appName}
                    value={`${debugInfo.usageMinutes[app.packageName] ?? '?'} / ${app.limitMinutes} min`}
                    ok={(debugInfo.usageMinutes[app.packageName] ?? 0) < app.limitMinutes}
                  />
                ))}
              </>
            )}

            <Text style={dbg.hint}>
              Midnight reset: when the "Today's reset key" date changes (after midnight),
              the reminder can fire again for each app.
            </Text>
          </>
        )}

        {/* Refresh button — tap to read fresh values */}
        <PressScale style={dbg.refreshBtn} onPress={refresh}>
          <Text style={dbg.refreshTxt}>↻  Refresh</Text>
        </PressScale>
      </ScrollView>
    </ModalShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const insets = useSafeAreaInsets();

  const [monitoredApps, setMonitoredApps] = useState([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [pickerApps, setPickerApps] = useState([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [limitHours, setLimitHours] = useState('0');
  const [limitMins, setLimitMins] = useState('30');
  const [message, setMessage] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasAccess, setHasAccess] = useState(null);   // Usage access: null = not checked yet
  const [usage, setUsage] = useState({});             // { packageName: minutes used today }
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [notifOk, setNotifOk] = useState(null);       // notifications allowed? null = not checked yet
  const [loaded, setLoaded] = useState(false);        // true after saved apps are read from the phone
  const [batteryHintDone, setBatteryHintDone] = useState(true);  // true = do not show the battery tip
  const [isPro, setIsPro] = useState(false);                      // free plan until Pro is bought
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Editing an existing app vs adding a new one
  const [isEditing, setIsEditing] = useState(false);
  const [originalPhotoUri, setOriginalPhotoUri] = useState(null);
  // Debug panel — only used in development builds (__DEV__)
  const [isDebugOpen, setIsDebugOpen] = useState(false);

  useEffect(() => { loadSaved(); }, []);

  const loadSaved = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) setMonitoredApps(JSON.parse(json));
      // Show the battery tip until the user has tapped "Got it" once
      const hint = await AsyncStorage.getItem(BATTERY_HINT_KEY);
      setBatteryHintDone(hint === 'done');
      // Only honor the dev-only Pro test switch in development builds (__DEV__).
      // Real Google Play Billing entitlement will be added in M7.
      setIsPro(__DEV__ && (await AsyncStorage.getItem(PRO_KEY)) === 'yes');
    } catch (e) { console.error(e); }
    finally { setLoaded(true); }
  };

  const saveAll = async (list) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { console.error(e); }
  };

  // ── Usage: ask Android how long each monitored app was used today ──
  const refreshUsage = async (list = monitoredApps) => {
    if (!hasNativeUsage) return;
    try {
      const ok = nativeModule.hasUsageAccess();
      if (typeof nativeModule.getUsageAccessDebug === 'function') {
        console.log('[usage] access =', ok, '|', nativeModule.getUsageAccessDebug());
      }
      setHasAccess(ok);
      if (hasNativeNotify) setNotifOk(nativeModule.areNotificationsEnabled());
      if (ok && list.length > 0) {
        const result = await nativeModule.getTodayUsageMinutes(list.map(a => a.packageName));
        setUsage(result);
      }
    } catch (e) {
      console.warn('Reading usage failed:', e);
    }
  };

  // Refresh when the list changes, every 30 seconds, and whenever the user
  // comes back to our app (for example after turning on Usage access in Settings).
  useEffect(() => {
    refreshUsage(monitoredApps);
    let lateCheck = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshUsage(monitoredApps);
        // Check once more after a moment: Android may need a second to apply a Settings change
        lateCheck = setTimeout(() => refreshUsage(monitoredApps), 1500);
      }
    });
    const timer = setInterval(() => refreshUsage(monitoredApps), 30000);
    return () => { sub.remove(); clearInterval(timer); clearTimeout(lateCheck); };
  }, [monitoredApps]);

  // ── Keep the background watcher in step with the list of apps ──
  // Every time the list changes we give the Kotlin side a fresh copy
  // (it works even when this screen is closed), then start or stop the watcher.
  useEffect(() => {
    if (!hasNativeNotify || !loaded || hasAccess === null) return;
    try {
      // Only send apps allowed by the current plan.
      // Extra apps stay saved on the screen as "Paused" and are never deleted.
      const activeApps = monitoredApps.filter((_, index) => isAppActiveForPlan(index, isPro));
      const items = activeApps.map(a => ({
        appName: a.appName,
        packageName: a.packageName,
        limitMinutes: a.limitMinutes,
        message: a.message,
        photoUri: a.photoUri || null,
      }));
      // index.ts turns the list into text by itself, so we pass the list as it is
      nativeModule.saveWatchList(items);
      console.log('[watch] saved', items.length, 'active app(s); usage access =', hasAccess);
      if (items.length > 0 && hasAccess) nativeModule.startWatching();
      else nativeModule.stopWatching();
    } catch (e) {
      console.warn('Watcher sync failed:', e);
    }
  }, [monitoredApps, hasAccess, loaded, isPro]);

  // ── Notification permission (Android 13 and newer shows its own pop-up) ──
  const askNotifPermission = async () => {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      // Ask Android for the real answer (the user may also have turned the channel off)
      const enabled = nativeModule.areNotificationsEnabled();
      setNotifOk(enabled);
      return enabled;
    } catch (e) {
      console.warn('Notification permission failed:', e);
      return false;
    }
  };

  // ── Show the reminder now, so the user sees how it will look ──
  const onTestReminder = async (app) => {
    try {
      const allowed = await askNotifPermission();
      if (!allowed) {
        Alert.alert(
          'Notifications are off',
          'Please allow notifications for App Time Notifier in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const result = nativeModule.showTestNotification(app.packageName);
      // New Kotlin code answers "ok" or a sentence; the older one answered true/false
      if (result !== 'ok' && result !== true) {
        Alert.alert('Could not show it', result === false ? 'Please try again in a moment.' : String(result));
      }
    } catch (e) {
      console.warn('Test reminder failed:', e);
    }
  };

  // ── Free plan: the free version watches only FREE_APP_LIMIT apps ──
  const onAddPressed = () => {
    if (!canAddApp(monitoredApps.length, isPro)) {
      setIsUpgradeOpen(true);   // show the upgrade screen instead of the app list
      return;
    }
    openPicker();
  };

  // Testing only: lets us try both plans without payment. The button that
  // calls this is shown only in development builds (see __DEV__ below).
  const toggleProForTesting = async () => {
    const next = !isPro;
    setIsPro(next);
    try { await AsyncStorage.setItem(PRO_KEY, next ? 'yes' : 'no'); } catch (_) { /* not important */ }
    if (next) setIsUpgradeOpen(false);
  };

  // ── Battery tip: some phones stop background apps to save battery ──
  // This opens Android's own battery page. No special permission is needed.
  const openBatterySettings = () => {
    Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')
      .catch(() => Linking.openSettings());   // fallback: our app's settings page
  };
  const dismissBatteryHint = async () => {
    setBatteryHintDone(true);
    try { await AsyncStorage.setItem(BATTERY_HINT_KEY, 'done'); } catch (_) { /* not important */ }
  };

  // ── Open Android Settings where the user turns on Usage access ──
  const goToAccessSettings = () => {
    setIsAccessOpen(false);
    try {
      nativeModule.openUsageAccessSettings();
    } catch (e) {
      Alert.alert(
        'Could not open Settings',
        'Please open Settings > Apps > Special app access > Usage access, and allow App Time Notifier.'
      );
    }
  };

  // ── Open the picker: installed apps only ──
  const openPicker = async () => {
    setSearchQuery('');
    setPickerError('');
    setPickerApps([]);
    setIsPickerOpen(true);

    if (!nativeGetInstalledApps) {
      setPickerError(
        'The app list reader is not part of this build yet.\n\n' +
        'Close the app, run "npx expo run:android" again, and open it.'
      );
      return;
    }
    setIsLoadingApps(true);
    try {
      const apps = await nativeGetInstalledApps();
      setPickerApps(apps);
    } catch (e) {
      console.warn('Reading installed apps failed:', e);
      setPickerError('Could not read the apps on your phone. Please try again.');
    } finally {
      setIsLoadingApps(false);
    }
  };

  // ── App tapped in the picker ──
  const onAppTapped = (app) => {
    if (monitoredApps.some(m => m.packageName === app.packageName)) {
      Alert.alert('Already added', `${app.appName} is already in your list.`);
      return;
    }
    setSelectedApp(app);
    setIsEditing(false);
    setOriginalPhotoUri(null);
    setIsPickerOpen(false);
    setLimitHours('0');
    setLimitMins('30');
    setMessage('');
    setPhotoUri(null);
    setIsLimitOpen(true);
  };

  // ── Edit an existing app card ──
  const onEditApp = (app) => {
    setSelectedApp(app);
    setIsEditing(true);
    setOriginalPhotoUri(app.photoUri || null);
    setLimitHours(String(Math.floor(app.limitMinutes / 60)));
    setLimitMins(String(app.limitMinutes % 60));
    setMessage(app.message || '');
    setPhotoUri(app.photoUri || null);
    setIsLimitOpen(true);
  };

  // Close the Add/Edit modal without saving.
  // Only delete a photo if it is a NEW unsaved photo (not the app's original saved photo).
  const closeLimitModal = () => {
    if (photoUri && photoUri !== originalPhotoUri) {
      deleteFileQuietly(photoUri);
    }
    setPhotoUri(null);
    setOriginalPhotoUri(null);
    setSelectedApp(null);
    setIsEditing(false);
    setIsLimitOpen(false);
  };

  // ── Pick a photo and keep a private copy inside the app ──
  // Why copy? The picker gives a temporary file. A copy in the app's own
  // folder stays as long as the app is installed.
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // allowsEditing: false skips the confusing crop window, so tapping a photo selects it right away
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled) return;

      // Our Kotlin code makes the private, smaller copy and gives us its address
      const saved = await nativeModule.savePhoto(result.assets[0].uri);
      // Only delete the previous photo if it is not the original saved photo (in case user cancels Edit)
      if (photoUri && photoUri !== originalPhotoUri) deleteFileQuietly(photoUri);
      setPhotoUri(saved);
    } catch (e) {
      console.warn('Photo pick failed:', e);
      Alert.alert('Photo problem', 'Could not add the photo. Please try another one.');
    }
  };

  // ── Use a sample picture as the reminder photo ──
  // Same path as a picked photo: our Kotlin code makes the private copy.
  const onUseSamplePhoto = async (sampleSource) => {
    try {
      const asset = Asset.fromModule(sampleSource);
      try {
        await asset.downloadAsync();               // works in debug builds (downloads from Metro)
      } catch (_) {
        // In release builds, bundled assets live inside Android resources instead
      }
      const resolved = Image.resolveAssetSource(sampleSource);
      const uri = asset.localUri || asset.uri || (resolved && resolved.uri);
      const saved = await nativeModule.savePhoto(uri);
      if (photoUri && photoUri !== originalPhotoUri) deleteFileQuietly(photoUri);
      setPhotoUri(saved);
    } catch (e) {
      console.warn('Sample photo failed:', e);
      Alert.alert('Photo problem', 'Could not use the sample picture. Please try again.');
    }
  };

  const totalMinutes = (parseInt(limitHours, 10) || 0) * 60 + (parseInt(limitMins, 10) || 0);

  // ── Save the limit ──
  const onSave = async () => {
    if ((parseInt(limitMins, 10) || 0) > 59) {
      Alert.alert('Check minutes', 'Minutes must be between 0 and 59. Use the Hours box for more.');
      return;
    }
    if ((parseInt(limitHours, 10) || 0) > 23) {
      Alert.alert('Check hours', 'Hours must be between 0 and 23.');
      return;
    }
    if (totalMinutes < 1) {
      Alert.alert('Time needed', 'Please set a limit of at least 1 minute.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Message needed', 'Please type your notification message.');
      return;
    }
    const entry = {
      appName: selectedApp.appName,
      packageName: selectedApp.packageName,
      icon: selectedApp.icon || null,
      limitMinutes: totalMinutes,
      message: message.trim(),
      photoUri: photoUri,
    };

    // If editing, delete the old photo only if it was changed or removed
    if (isEditing && originalPhotoUri && originalPhotoUri !== photoUri) {
      deleteFileQuietly(originalPhotoUri);
    }

    const updated = isEditing
      ? monitoredApps.map(a => a.packageName === entry.packageName ? entry : a)
      : [...monitoredApps, entry];

    setMonitoredApps(updated);
    await saveAll(updated);
    setIsLimitOpen(false);
    setSelectedApp(null);
    setOriginalPhotoUri(null);
    setIsEditing(false);
    refreshUsage(updated);
    // Ask for notification permission (Android shows its own pop-up if needed)
    if (hasNativeNotify) await askNotifPermission();
    // First time: explain "Usage access" before sending the user to Settings.
    if (hasNativeUsage && hasAccess === false) {
      setTimeout(() => setIsAccessOpen(true), 400);
    }
  };

  // ── Delete an app card (and its photo file) ──
  const onDelete = (app) => {
    Alert.alert('Remove app', 'Stop monitoring this app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          deleteFileQuietly(app.photoUri);
          const updated = monitoredApps.filter(a => a.packageName !== app.packageName);
          // Makes the remaining cards slide smoothly into place.
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMonitoredApps(updated);
          await saveAll(updated);
        }
      },
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
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Header: padded by the notch / status bar height ── */}
      <FadeInUp style={[s.header, { paddingTop: insets.top + 18 }]}>
        <View style={s.headerRow}>
          <View style={s.headerTextWrap}>
            <Text style={s.title}>App Time Notifier</Text>
            <Text style={s.subtitle}>Gentle reminders, right when you need them</Text>
          </View>
          <PressScale style={s.settingsBtn} onPress={() => setIsSettingsOpen(true)}>
            <Text style={s.settingsBtnTxt}>⚙</Text>
          </PressScale>
        </View>
        {/* Subtitle only — v1 is 100% free with unlimited apps */}
      </FadeInUp>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {monitoredApps.length === 0 ? (
          <FadeInUp delay={150} style={s.empty}>
            <Floating>
              <View style={s.emptyCircle}><Text style={s.emptyEmoji}>🌿</Text></View>
            </Floating>
            <Text style={s.emptyTitle}>Nothing to watch yet</Text>
            <Text style={s.emptyText}>
              Pick an app, set a daily limit, and write a kind message for yourself.
              When the time is up, we will send it as a gentle reminder.
            </Text>
          </FadeInUp>
        ) : (
          <>
            {hasAccess === false && (
              <FadeInUp style={s.banner}>
                <Text style={s.bannerTitle}>Allow Usage access</Text>
                <Text style={s.bannerText}>
                  We need it to see how long you use your chosen apps. Nothing leaves your phone.
                </Text>
                <View style={s.bannerBtns}>
                  <PressScale onPress={() => setIsAccessOpen(true)} style={s.bannerBtn}>
                    <Text style={s.bannerBtnTxt}>Turn on</Text>
                  </PressScale>
                  <PressScale onPress={() => refreshUsage(monitoredApps)} style={s.bannerBtnOutline}>
                    <Text style={s.bannerBtnOutlineTxt}>Check again</Text>
                  </PressScale>
                </View>
              </FadeInUp>
            )}
            {notifOk === false && (
              <FadeInUp style={s.banner}>
                <Text style={s.bannerTitle}>Allow notifications</Text>
                <Text style={s.bannerText}>
                  We need them to send your reminder when a limit is reached.
                </Text>
                <View style={s.bannerBtns}>
                  <PressScale onPress={() => Linking.openSettings()} style={s.bannerBtn}>
                    <Text style={s.bannerBtnTxt}>Open settings</Text>
                  </PressScale>
                </View>
              </FadeInUp>
            )}
            {!batteryHintDone && (
              <FadeInUp style={s.tipCard}>
                <Text style={s.tipTitle}>Keep reminders reliable</Text>
                <Text style={s.bannerText}>
                  Some phones stop apps in the background to save battery. If a reminder ever comes
                  late or not at all, open the battery settings and set App Time Notifier to
                  "Don't optimize" (on some phones it is called "Unrestricted").
                </Text>
                <View style={s.bannerBtns}>
                  <PressScale onPress={openBatterySettings} style={s.bannerBtn}>
                    <Text style={s.bannerBtnTxt}>Open battery settings</Text>
                  </PressScale>
                  <PressScale onPress={dismissBatteryHint} style={s.bannerBtnOutline}>
                    <Text style={s.bannerBtnOutlineTxt}>Got it</Text>
                  </PressScale>
                </View>
              </FadeInUp>
            )}
            <Text style={s.sectionLabel}>
              {monitoredApps.length === 1 ? '1 app watched' : `${monitoredApps.length} apps watched`}
            </Text>
            {monitoredApps.map((app, index) => {
              const active = isAppActiveForPlan(index, isPro);
              return (
                <FadeInUp key={app.packageName} delay={Math.min(index, 5) * 70} style={[s.card, !active && s.cardPaused]}>
                  <View style={s.cardTop}>
                    <View style={s.iconTile}><AppIcon icon={app.icon} size={36} /></View>
                    <View style={s.cardInfo}>
                      <Text style={s.cardName} numberOfLines={1}>{app.appName}</Text>
                      <View style={s.pillRow}>
                        <View style={s.pill}>
                          <Text style={s.pillTxt}>⏱  {fmtLimit(app.limitMinutes)} per day</Text>
                        </View>
                        {!active && (
                          <View style={s.pausedPill}>
                            <Text style={s.pausedPillTxt}>Paused · Pro needed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={s.cardActions}>
                      <Pressable onPress={() => onEditApp(app)} style={s.editBtn} hitSlop={10}>
                        <Text style={s.editTxt}>✎</Text>
                      </Pressable>
                      <Pressable onPress={() => onDelete(app)} style={s.delBtn} hitSlop={10}>
                        <Text style={s.delTxt}>✕</Text>
                      </Pressable>
                    </View>
                  </View>

                  {hasAccess ? (
                    <View style={s.usageBox}>
                      <View style={s.usageRow}>
                        <Text style={s.usageLabel}>Used today</Text>
                        <Text style={s.usageValue}>
                          {fmtLimit(usage[app.packageName] || 0)} / {fmtLimit(app.limitMinutes)}
                        </Text>
                      </View>
                      <ProgressBar value={(usage[app.packageName] || 0) / app.limitMinutes} />
                    </View>
                  ) : null}

                  <View style={s.msgRow}>
                    <View style={s.msgBar} />
                    <Text style={s.cardMsg} numberOfLines={3}>{app.message}</Text>
                    {app.photoUri ? (
                      <Image source={{ uri: app.photoUri }} style={s.cardPhoto} />
                    ) : null}
                  </View>
                </FadeInUp>
              );
            })}
            <Text style={s.note}>
              While watching, Android shows a small "Watching your app limits" notice.
              That is how it lets us check your usage in the background.
            </Text>
          </>
        )}
      </ScrollView>

      {/* ── Add button stays at the bottom, above the navigation bar ── */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <PressScale onPress={onAddPressed} style={s.addBtn}>
          <Text style={s.addBtnTxt}>+  Add App to Monitor</Text>
        </PressScale>
        {/* Debug button: __DEV__ is true only in development builds.
            In a release build this whole block is removed automatically. */}
        {__DEV__ && (
          <Pressable onPress={() => setIsDebugOpen(true)} style={s.debugBtn}>
            <Text style={s.debugBtnTxt}>🛠 Debug</Text>
          </Pressable>
        )}
      </View>

      {/* ══════════ APP PICKER (installed apps only) ══════════ */}
      <ModalShell visible={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Choose an App">
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput} placeholder="Search apps..." placeholderTextColor={C.dim}
            value={searchQuery} onChangeText={setSearchQuery}
          />
        </View>

        {isLoadingApps ? (
          <View style={s.centerBox}>
            <ActivityIndicator size="large" color={C.mint} />
            <Text style={s.centerTxt}>Reading apps on your phone...</Text>
          </View>
        ) : pickerError ? (
          <View style={s.centerBox}>
            <Text style={s.centerTxt}>{pickerError}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.packageName}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <PressScale onPress={() => onAppTapped(item)} style={s.listItem}>
                <View style={s.listIcon}><AppIcon icon={item.icon} size={36} /></View>
                <Text style={s.listName} numberOfLines={1}>{item.appName}</Text>
                <Text style={s.chevron}>›</Text>
              </PressScale>
            )}
            ListFooterComponent={<View style={{ height: 30 }} />}
            ListEmptyComponent={
              <Text style={s.noResults}>No apps found for "{searchQuery}"</Text>
            }
          />
        )}
      </ModalShell>

      {/* ══════════ TIME LIMIT + MESSAGE + PHOTO ══════════ */}
      <ModalShell
        visible={isLimitOpen} onClose={closeLimitModal}
        title={selectedApp ? selectedApp.appName : ''}
        left={selectedApp ? <View style={s.hdrIcon}><AppIcon icon={selectedApp.icon} size={30} /></View> : null}
      >
        <ScrollView
          style={s.limitScroll} contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        >
          {/* ── Flexible time limit ── */}
          <Text style={s.secLabel}>Daily Time Limit</Text>
          <Text style={s.secHint}>
            Type hours and minutes, or tap a quick choice. We will remind you when you reach it.
          </Text>

          <View style={s.timeRow}>
            <View style={s.timeBox}>
              <TextInput
                style={s.timeInput} keyboardType="number-pad"
                value={limitHours} onChangeText={t => setLimitHours(onlyDigits(t))}
                selectTextOnFocus
              />
              <Text style={s.timeUnit}>hours</Text>
            </View>
            <Text style={s.timeColon}>:</Text>
            <View style={s.timeBox}>
              <TextInput
                style={s.timeInput} keyboardType="number-pad"
                value={limitMins} onChangeText={t => setLimitMins(onlyDigits(t))}
                selectTextOnFocus
              />
              <Text style={s.timeUnit}>minutes</Text>
            </View>
          </View>
          <Text style={s.totalTxt}>
            {totalMinutes >= 1 ? `${fmtLimit(totalMinutes)} per day` : 'Set at least 1 minute'}
          </Text>

          <View style={s.chips}>
            {QUICK_LIMITS.map(opt => {
              const on = (parseInt(limitHours, 10) || 0) === opt.h && (parseInt(limitMins, 10) || 0) === opt.m;
              return (
                <PressScale
                  key={opt.label} style={[s.chip, on && s.chipOn]}
                  onPress={() => { setLimitHours(String(opt.h)); setLimitMins(String(opt.m)); }}
                >
                  <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt.label}</Text>
                </PressScale>
              );
            })}
          </View>

          {/* ── Message ── */}
          <Text style={s.secLabel}>Your Message</Text>
          <Text style={s.secHint}>Write your own words, or tap an idea to use it.</Text>
          <View style={s.ideas}>
            {MESSAGE_IDEAS.map((idea, i) => (
              <PressScale key={i} style={s.idea} onPress={() => setMessage(idea)}>
                <Text style={s.ideaTxt} numberOfLines={2}>{idea}</Text>
              </PressScale>
            ))}
          </View>
          <TextInput
            style={s.msgInput}
            placeholder="Type your own message here..."
            placeholderTextColor={C.dim}
            value={message} onChangeText={setMessage}
            multiline maxLength={200}
          />
          <Text style={s.charCount}>{message.length}/200</Text>

          {/* ── Photo ── */}
          <Text style={s.secLabel}>Photo (optional)</Text>
          <Text style={s.secHint}>
            Choose a photo of someone you love. It stays on your phone and is shown with the reminder.
          </Text>
          {photoUri ? (
            <View style={s.photoWrap}>
              {/* key = the file path, so a new photo always draws a fresh image */}
              <Image
                key={photoUri} source={{ uri: photoUri }} style={s.photoPreview}
                resizeMode="cover" fadeDuration={0}
                onError={(e) => console.warn('Photo preview failed:', JSON.stringify(e.nativeEvent), photoUri)}
              />
              {/* The two buttons sit on the photo, at the bottom */}
              <View style={s.photoBtns}>
                <PressScale style={[s.photoBtn, s.photoBtnChange]} onPress={pickPhoto}>
                  <Text style={s.photoBtnChangeTxt}>✎  Change</Text>
                </PressScale>
                <PressScale
                  style={[s.photoBtn, s.photoBtnRemove]}
                  onPress={() => {
                    if (photoUri && photoUri !== originalPhotoUri) deleteFileQuietly(photoUri);
                    setPhotoUri(null);
                  }}
                >
                  <Text style={s.photoBtnRemoveTxt}>✕  Remove</Text>
                </PressScale>
              </View>
            </View>
          ) : (
            <>
              <PressScale style={s.photoAdd} onPress={pickPhoto}>
                <Text style={s.photoAddEmoji}>🖼️</Text>
                <Text style={s.photoAddTxt}>Choose a photo</Text>
              </PressScale>

              {/* Sample pictures: tap any one to use it as the photo */}
              <Text style={s.demoSectionTitle}>Or try a sample picture</Text>
              <View style={s.demoGrid}>
                {SAMPLE_PHOTOS.map((sample) => (
                  <PressScale
                    key={sample.id}
                    wrapStyle={s.demoGridItem}
                    style={s.demoTile}
                    onPress={() => onUseSamplePhoto(sample.source)}
                  >
                    <Image source={sample.source} style={s.demoThumb} />
                    <Text style={s.demoTileLabel} numberOfLines={1}>{sample.label}</Text>
                  </PressScale>
                ))}
              </View>
            </>
          )}

          <PressScale style={s.saveBtn} onPress={onSave}>
            <Text style={s.saveBtnTxt}>Save</Text>
          </PressScale>
        </ScrollView>
      </ModalShell>

      {/* ══════════ UPGRADE TO PRO ══════════ */}
      <ModalShell visible={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} title="Upgrade to Pro">
        <ScrollView style={s.limitScroll} contentContainerStyle={s.accessWrap}>
          <View style={s.emptyCircle}><Text style={s.emptyEmoji}>✨</Text></View>
          <Text style={s.accessTitle}>Watch more apps</Text>
          <View style={s.accessQuote}>
            <Text style={s.accessText}>
              The free plan watches {FREE_APP_LIMIT} app. Pro lets you watch as many apps as you
              like, each with its own limit, message and photo.
            </Text>
          </View>
          <Text style={s.accessSteps}>
            Payments are not set up yet. Pro will be available when App Time Notifier is on Google Play.
          </Text>
          {__DEV__ ? (
            <PressScale wrapStyle={s.stretch} style={s.devBtn} onPress={toggleProForTesting}>
              <Text style={s.devBtnTxt}>
                Developer only: {isPro ? 'turn Pro off' : 'turn Pro on'} (testing)
              </Text>
            </PressScale>
          ) : null}
          <PressScale wrapStyle={s.stretch} style={s.laterBtn} onPress={() => setIsUpgradeOpen(false)}>
            <Text style={s.laterTxt}>Maybe later</Text>
          </PressScale>
        </ScrollView>
      </ModalShell>

      {/* ══════════ USAGE ACCESS EXPLANATION (shown before opening Settings) ══════════ */}
      <ModalShell visible={isAccessOpen} onClose={() => setIsAccessOpen(false)} title="Usage access">
        <ScrollView style={s.limitScroll} contentContainerStyle={s.accessWrap}>
          <View style={s.emptyCircle}><Text style={s.emptyEmoji}>🔒</Text></View>
          <Text style={s.accessTitle}>Why we ask</Text>
          <View style={s.accessQuote}>
            <Text style={s.accessText}>
              This app uses "Usage access" to see how long you use the apps you choose,
              so it can send you a reminder. This information stays on your phone.
              It is never uploaded or shared.
            </Text>
          </View>
          <Text style={s.accessSteps}>
            On the next screen, find App Time Notifier and turn on "Allow usage access".
            Then come back to this app.{'\n\n'}
            If the switch already shows ON but this app still asks, switch it OFF and
            then ON again. Some phones keep an old state.
          </Text>
          <PressScale wrapStyle={s.stretch} style={s.saveBtn} onPress={goToAccessSettings}>
            <Text style={s.saveBtnTxt}>Continue to Settings</Text>
          </PressScale>
          <PressScale wrapStyle={s.stretch} style={s.laterBtn} onPress={() => setIsAccessOpen(false)}>
            <Text style={s.laterTxt}>Not now</Text>
          </PressScale>
        </ScrollView>
      </ModalShell>

      {/* ══════════ SETTINGS ══════════ */}
      <ModalShell visible={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Settings">
        <ScrollView style={s.limitScroll} contentContainerStyle={{ paddingBottom: 36 }}>
          <Text style={s.secLabel}>Permissions &amp; Reliability</Text>

          <View style={s.settingCard}>
            <View style={s.settingRow}>
              <View style={s.settingInfo}>
                <Text style={s.settingTitle}>Usage access</Text>
                <Text style={s.settingSub}>
                  {hasAccess ? 'Allowed · reading today\'s screen time' : 'Off · needed to count app time'}
                </Text>
              </View>
              <PressScale
                style={s.settingAction}
                onPress={() => { setIsSettingsOpen(false); setIsAccessOpen(true); }}
              >
                <Text style={s.settingActionTxt}>{hasAccess ? 'Check' : 'Turn on'}</Text>
              </PressScale>
            </View>
          </View>

          <View style={s.settingCard}>
            <View style={s.settingRow}>
              <View style={s.settingInfo}>
                <Text style={s.settingTitle}>Notifications</Text>
                <Text style={s.settingSub}>
                  {notifOk === false ? 'Off · needed to show reminders' : 'Allowed'}
                </Text>
              </View>
              <PressScale style={s.settingAction} onPress={() => Linking.openSettings()}>
                <Text style={s.settingActionTxt}>App settings</Text>
              </PressScale>
            </View>
          </View>

          <View style={s.settingCard}>
            <View style={s.settingRow}>
              <View style={s.settingInfo}>
                <Text style={s.settingTitle}>Battery settings</Text>
                <Text style={s.settingSub}>
                  Set to "Don't optimize" or "Unrestricted" so background reminders are never stopped.
                </Text>
              </View>
              <PressScale style={s.settingAction} onPress={openBatterySettings}>
                <Text style={s.settingActionTxt}>Open</Text>
              </PressScale>
            </View>
          </View>

          <Text style={s.secLabel}>About</Text>
          <View style={s.settingCard}>
            <Text style={s.settingTitle}>100% Free · Unlimited Apps</Text>
            <Text style={s.settingSub}>
              Watch as many apps as you like with your own messages and photos. No ads and no payments.
            </Text>
          </View>

          <Text style={s.secLabel}>Privacy</Text>
          <View style={s.settingCard}>
            <Text style={s.settingSub}>
              All usage numbers, messages, and photos stay on your phone. App Time Notifier has no
              server, no account, and no ads.
            </Text>
          </View>

          <Text style={s.versionTxt}>App Time Notifier · Version 1.0.0</Text>
        </ScrollView>
      </ModalShell>

      {/* ══════════ DEBUG PANEL (dev builds only) ══════════ */}
      {__DEV__ && (
        <DebugPanel
          visible={isDebugOpen}
          onClose={() => setIsDebugOpen(false)}
          monitoredApps={monitoredApps}
        />
      )}
    </View>
  );
}

// Styles only used inside the DebugPanel component
const dbg = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 20 },
  section: { color: C.mint, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { color: C.dim, fontSize: 13, flex: 1, marginRight: 8 },
  value: { color: C.text, fontSize: 13, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  good: { color: C.mint },
  bad: { color: C.softRed },
  error: { color: C.softRed, fontSize: 13, margin: 20 },
  hint: { color: C.dim, fontSize: 12, lineHeight: 18, marginTop: 20, fontStyle: 'italic' },
  refreshBtn: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: 'center', marginTop: 24 },
  refreshTxt: { color: C.mint, fontSize: 14, fontWeight: '700' },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  // Header
  header: { paddingHorizontal: 24, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerTextWrap: { flex: 1 },
  settingsBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  settingsBtnTxt: { color: C.text, fontSize: 18 },
  title: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: C.dim, marginTop: 6 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },

  // Empty state
  empty: { alignItems: 'center', marginTop: 50, paddingHorizontal: 12 },
  emptyCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.mintTint, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: 28, marginBottom: 10 },
  emptyText: { fontSize: 14, color: C.dim, textAlign: 'center', lineHeight: 22 },

  // Cards
  sectionLabel: { color: C.dim, fontSize: 13, letterSpacing: 0.6, marginBottom: 12, marginLeft: 4 },
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  cardPaused: { opacity: 0.65 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconTile: { width: 56, height: 56, borderRadius: 16, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, color: C.text, fontWeight: '600' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  pill: { alignSelf: 'flex-start', backgroundColor: C.mintTint, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { color: C.mint, fontSize: 12, fontWeight: '600' },
  pausedPill: { alignSelf: 'flex-start', backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.softRed },
  pausedPillTxt: { color: C.softRed, fontSize: 11, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8 },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  editTxt: { color: C.mint, fontSize: 14, fontWeight: '700' },
  delBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  delTxt: { color: C.softRed, fontSize: 13, fontWeight: '700' },

  msgRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: C.surface2, borderRadius: 14, padding: 12 },
  msgBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: C.mint, marginRight: 12 },
  cardMsg: { flex: 1, fontSize: 13, color: C.dim, lineHeight: 19 },
  cardPhoto: { width: 52, height: 52, borderRadius: 12, marginLeft: 12 },

  note: { color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18, opacity: 0.8 },

  // Footer button
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: C.bg },
  addBtn: { backgroundColor: C.mint, borderRadius: 18, paddingVertical: 17, alignItems: 'center' },
  addBtnTxt: { color: C.mintDark, fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  // Modals
  modalArea: { flex: 1, backgroundColor: C.bg },
  modalHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  hdrLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  hdrIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, flexShrink: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  closeTxt: { color: C.dim, fontSize: 15 },

  // Picker
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 10, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border },
  searchIcon: { fontSize: 15, marginRight: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 13 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 16 },
  centerTxt: { color: C.dim, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  listIcon: { marginRight: 14 },
  listName: { fontSize: 15, color: C.text, flex: 1 },
  chevron: { color: C.dim, fontSize: 22, marginLeft: 8 },
  noResults: { color: C.dim, textAlign: 'center', marginTop: 40, fontSize: 15 },

  // Limit modal
  limitScroll: { flex: 1, paddingHorizontal: 20 },
  secLabel: { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 22, marginBottom: 6 },
  secHint: { fontSize: 13, color: C.dim, marginBottom: 14, lineHeight: 19 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBox: { flex: 1, backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', paddingVertical: 12 },
  timeInput: { color: C.text, fontSize: 36, fontWeight: '700', textAlign: 'center', minWidth: 90 },
  timeUnit: { color: C.dim, fontSize: 13 },
  timeColon: { color: C.dim, fontSize: 28, fontWeight: '700' },
  totalTxt: { color: C.mint, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 12, marginBottom: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  chipOn: { borderColor: C.mint, backgroundColor: C.mintTint },
  chipTxt: { color: C.dim, fontSize: 14 },
  chipTxtOn: { color: C.mint, fontWeight: '700' },

  ideas: { gap: 8, marginBottom: 12 },
  idea: { backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  ideaTxt: { color: C.dim, fontSize: 13, lineHeight: 19 },

  msgInput: { backgroundColor: C.surface, borderRadius: 16, padding: 16, color: C.text, fontSize: 14, lineHeight: 22, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: C.border },
  charCount: { color: C.dim, fontSize: 11, textAlign: 'right', marginTop: 6 },

  photoAdd: { backgroundColor: C.surface, borderRadius: 18, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed', paddingVertical: 28, alignItems: 'center', gap: 8 },
  photoAddEmoji: { fontSize: 30 },
  photoAddTxt: { color: C.dim, fontSize: 14 },
  photoWrap: { borderRadius: 20, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  demoSectionTitle: { color: C.dim, fontSize: 13, marginTop: 16, marginBottom: 10 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  demoGridItem: { width: '48%' },
  demoTile: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 10, alignItems: 'center' },
  demoThumb: { width: '100%', height: 100, borderRadius: 12 },
  demoTileLabel: { color: C.text, fontSize: 13, fontWeight: '600', marginTop: 8 },
  photoPreview: { width: '100%', height: 220 },
  photoBtns: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 10 },
  photoBtn: { borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: 'rgba(15,28,36,0.8)', borderWidth: 1 },
  photoBtnChange: { borderColor: C.mint },
  photoBtnRemove: { borderColor: C.softRed },
  photoBtnChangeTxt: { color: C.mint, fontSize: 14, fontWeight: '700' },
  photoBtnRemoveTxt: { color: C.softRed, fontSize: 14, fontWeight: '700' },

  // Usage on cards
  usageBox: { marginTop: 14 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  usageLabel: { color: C.dim, fontSize: 13 },
  usageValue: { color: C.text, fontSize: 13, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: C.surface2, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.mint },
  barFillFull: { backgroundColor: C.softRed },

  // Test reminder button on cards
  testBtn: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 10, alignItems: 'center' },
  testBtnTxt: { color: C.mint, fontSize: 13, fontWeight: '700' },

  // Plan pill (under the title) and upgrade screen
  pillWrap: { alignSelf: 'flex-start' },
  planPill: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  planPillPro: { backgroundColor: C.mintTint, borderColor: C.mint },
  planPillTxt: { color: C.dim, fontSize: 12, fontWeight: '700' },
  planPillProTxt: { color: C.mint },
  devBtn: { marginTop: 18, borderRadius: 14, borderWidth: 1, borderColor: C.softRed, borderStyle: 'dashed', paddingVertical: 12, alignItems: 'center' },
  devBtnTxt: { color: C.softRed, fontSize: 13, fontWeight: '700' },

  // Tip card (battery)
  tipCard: { backgroundColor: C.surface, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  tipTitle: { color: C.text, fontSize: 15, fontWeight: '700', marginBottom: 6 },

  // Banner (usage access is off)
  banner: { backgroundColor: C.mintTint, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.mint },
  bannerTitle: { color: C.mint, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  bannerText: { color: C.dim, fontSize: 13, lineHeight: 19 },
  bannerBtn: { alignSelf: 'flex-start', backgroundColor: C.mint, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 20 },
  bannerBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  bannerBtnOutline: { borderRadius: 14, paddingVertical: 9, paddingHorizontal: 20, borderWidth: 1, borderColor: C.mint },
  bannerBtnOutlineTxt: { color: C.mint, fontWeight: '700', fontSize: 14 },
  bannerBtnTxt: { color: C.mintDark, fontWeight: '700', fontSize: 14 },

  // Usage access explanation screen
  accessWrap: { alignItems: 'center', paddingTop: 24, paddingBottom: 30 },
  accessTitle: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 26, marginBottom: 14 },
  accessQuote: { backgroundColor: C.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, alignSelf: 'stretch' },
  accessText: { color: C.text, fontSize: 15, lineHeight: 24 },
  accessSteps: { color: C.dim, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 18, paddingHorizontal: 10 },
  laterBtn: { paddingVertical: 16, alignItems: 'center' },
  laterTxt: { color: C.dim, fontSize: 15 },

  stretch: { alignSelf: 'stretch' },
  saveBtn: { backgroundColor: C.mint, borderRadius: 18, paddingVertical: 17, paddingHorizontal: 28, alignItems: 'center', marginTop: 30 },
  saveBtnTxt: { color: C.mintDark, fontSize: 16, fontWeight: '700', letterSpacing: 0.4 },

  // Debug button (shown in footer in __DEV__ only)
  debugBtn: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 20 },
  debugBtnTxt: { color: C.dim, fontSize: 12, fontWeight: '600' },

  // Settings modal
  settingCard: { backgroundColor: C.surface, borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: C.border },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingInfo: { flex: 1 },
  settingTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  settingSub: { color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 3 },
  settingAction: { backgroundColor: C.mintTint, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.mint },
  settingActionTxt: { color: C.mint, fontSize: 13, fontWeight: '700' },
  versionTxt: { color: C.dim, fontSize: 12, textAlign: 'center', marginTop: 26, opacity: 0.7 },
});
