// App.js — App Time Notifier
// This is the main (and only) screen for now.
// It manages: list of monitored apps, the app picker modal, and the time limit modal.

import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInstalledApps } from './modules/app-list-reader';

// Key used to store data in AsyncStorage (phone's local storage)
const STORAGE_KEY = 'monitored_apps_v1';

// Time limit options the user can choose from
const TIME_LIMIT_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
];

export default function App() {
  // monitoredApps = the apps the user has chosen to watch
  const [monitoredApps, setMonitoredApps] = useState([]);

  // isPickerVisible = whether the "pick an app" modal is showing
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // isLimitVisible = whether the "set time limit" modal is showing
  const [isLimitVisible, setIsLimitVisible] = useState(false);

  // installedApps = list of all apps on the phone (loaded from native module)
  const [installedApps, setInstalledApps] = useState([]);

  // isLoadingApps = true while we're fetching the app list from Android
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  // selectedApp = the app the user just tapped in the picker (before setting limit)
  const [selectedApp, setSelectedApp] = useState(null);

  // selectedLimitMinutes = the time limit chosen in the limit modal
  const [selectedLimitMinutes, setSelectedLimitMinutes] = useState(30);

  // notificationMessage = the user's personal message for the notification
  const [notificationMessage, setNotificationMessage] = useState('');

  // searchQuery = text the user types to filter the app list
  const [searchQuery, setSearchQuery] = useState('');

  // On first load, read saved data from phone storage
  useEffect(() => {
    loadSavedApps();
  }, []);

  // Read saved monitored apps from AsyncStorage
  const loadSavedApps = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setMonitoredApps(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved apps:', error);
    }
  };

  // Save the monitored apps list to AsyncStorage
  const saveApps = async (apps) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
    } catch (error) {
      console.error('Failed to save apps:', error);
    }
  };

  // Called when user taps "+ Add App to Monitor"
  const openAppPicker = async () => {
    setIsPickerVisible(true);
    setIsLoadingApps(true);
    setSearchQuery('');
    try {
      // Ask the native Kotlin module for the list of installed apps
      const apps = await getInstalledApps();
      setInstalledApps(apps);
    } catch (error) {
      console.error('Failed to get installed apps:', error);
      Alert.alert('Error', 'Could not load installed apps. Please try again.');
    } finally {
      setIsLoadingApps(false);
    }
  };

  // Called when user taps an app in the picker list
  const onAppSelected = (app) => {
    // Check if this app is already being monitored
    const alreadyAdded = monitoredApps.some(
      (m) => m.packageName === app.packageName
    );
    if (alreadyAdded) {
      Alert.alert('Already added', `${app.appName} is already in your list.`);
      return;
    }
    setSelectedApp(app);
    setIsPickerVisible(false);
    setSelectedLimitMinutes(30); // reset to default
    setNotificationMessage(''); // reset message
    setIsLimitVisible(true);
  };

  // Called when user taps "Save" in the time limit modal
  const onSaveLimit = async () => {
    if (!selectedApp) return;

    if (!notificationMessage.trim()) {
      Alert.alert('Message needed', 'Please type a notification message.');
      return;
    }

    // Build the new monitored app entry
    const newEntry = {
      appName: selectedApp.appName,
      packageName: selectedApp.packageName,
      icon: selectedApp.icon,
      limitMinutes: selectedLimitMinutes,
      message: notificationMessage.trim(),
    };

    const updated = [...monitoredApps, newEntry];
    setMonitoredApps(updated);
    await saveApps(updated);
    setIsLimitVisible(false);
    setSelectedApp(null);
  };

  // Called when user taps the delete button on a monitored app card
  const onDeleteApp = (packageName) => {
    Alert.alert(
      'Remove app',
      'Stop monitoring this app?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = monitoredApps.filter(
              (a) => a.packageName !== packageName
            );
            setMonitoredApps(updated);
            await saveApps(updated);
          },
        },
      ]
    );
  };

  // Filter the installed apps list based on search text
  const filteredApps = installedApps.filter((app) =>
    app.appName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Convert minutes to a readable string (e.g. 90 → "1h 30m")
  const formatLimit = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* ── Top Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>App Time Notifier</Text>
        <Text style={styles.headerSubtitle}>Know when you've had enough</Text>
      </View>

      {/* ── Main Content ── */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Empty state */}
        {monitoredApps.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📱</Text>
            <Text style={styles.emptyTitle}>No apps monitored yet</Text>
            <Text style={styles.emptyText}>
              Tap the button below to pick an app and set a daily time limit.
              When you reach the limit, we will send you a gentle notification.
            </Text>
          </View>
        ) : (
          /* List of monitored apps */
          monitoredApps.map((app) => (
            <View key={app.packageName} style={styles.appCard}>
              <View style={styles.appCardLeft}>
                {/* Show app icon if we have one */}
                {app.icon ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${app.icon}` }}
                    style={styles.appIcon}
                  />
                ) : (
                  <View style={styles.appIconPlaceholder}>
                    <Text style={styles.appIconEmoji}>📱</Text>
                  </View>
                )}
                <View style={styles.appCardInfo}>
                  <Text style={styles.appCardName}>{app.appName}</Text>
                  <Text style={styles.appCardLimit}>
                    Daily limit: {formatLimit(app.limitMinutes)}
                  </Text>
                  <Text style={styles.appCardMessage} numberOfLines={1}>
                    "{app.message}"
                  </Text>
                </View>
              </View>
              {/* Delete button */}
              <TouchableOpacity
                onPress={() => onDeleteApp(app.packageName)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Add button */}
        <TouchableOpacity style={styles.addButton} onPress={openAppPicker}>
          <Text style={styles.addButtonText}>+ Add App to Monitor</Text>
        </TouchableOpacity>

        {/* Info note */}
        <Text style={styles.infoNote}>
          💡 Note: Background tracking and notifications will be set up in the next update.
        </Text>

      </ScrollView>

      {/* ── App Picker Modal ── */}
      {/* This Modal slides up and shows all installed apps */}
      <Modal
        visible={isPickerVisible}
        animationType="slide"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose an App</Text>
            <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search apps..."
              placeholderTextColor="#777"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Loading spinner while fetching app list */}
          {isLoadingApps ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e94560" />
              <Text style={styles.loadingText}>Loading installed apps...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredApps}
              keyExtractor={(item) => item.packageName}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.appListItem}
                  onPress={() => onAppSelected(item)}
                >
                  {item.icon ? (
                    <Image
                      source={{ uri: `data:image/png;base64,${item.icon}` }}
                      style={styles.appListIcon}
                    />
                  ) : (
                    <View style={styles.appListIconPlaceholder}>
                      <Text>📱</Text>
                    </View>
                  )}
                  <View style={styles.appListInfo}>
                    <Text style={styles.appListName}>{item.appName}</Text>
                    <Text style={styles.appListPackage} numberOfLines={1}>
                      {item.packageName}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noResultsText}>No apps found.</Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Time Limit Modal ── */}
      {/* Shows after user picks an app — they choose limit + message */}
      <Modal
        visible={isLimitVisible}
        animationType="slide"
        onRequestClose={() => setIsLimitVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedApp ? selectedApp.appName : ''}
            </Text>
            <TouchableOpacity onPress={() => setIsLimitVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.limitScrollView}>

            {/* Time limit picker */}
            <Text style={styles.sectionLabel}>Daily Time Limit</Text>
            <Text style={styles.sectionHint}>
              You will get a notification when you reach this limit.
            </Text>
            <View style={styles.limitOptions}>
              {TIME_LIMIT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.limitOption,
                    selectedLimitMinutes === opt.value && styles.limitOptionSelected,
                  ]}
                  onPress={() => setSelectedLimitMinutes(opt.value)}
                >
                  <Text
                    style={[
                      styles.limitOptionText,
                      selectedLimitMinutes === opt.value && styles.limitOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notification message input */}
            <Text style={styles.sectionLabel}>Your Notification Message</Text>
            <Text style={styles.sectionHint}>
              This is what you will see when the limit is reached. Write something personal!
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder={`e.g. "Time to put your phone down and do something meaningful!"`}
              placeholderTextColor="#777"
              value={notificationMessage}
              onChangeText={setNotificationMessage}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{notificationMessage.length}/200</Text>

            {/* Save button */}
            <TouchableOpacity style={styles.saveButton} onPress={onSaveLimit}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ──
const DARK_BG = '#1a1a2e';
const CARD_BG = '#16213e';
const ACCENT = '#e94560';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#a8a8b3';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: DARK_BG },

  header: {
    backgroundColor: CARD_BG,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 4,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: ACCENT, letterSpacing: 1 },
  headerSubtitle: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  emptyState: { alignItems: 'center', marginTop: 60, marginBottom: 40, padding: 20 },
  emptyEmoji: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_PRIMARY, marginBottom: 12 },
  emptyText: { fontSize: 14, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22 },

  appCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  appCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  appIcon: { width: 48, height: 48, borderRadius: 10, marginRight: 14 },
  appIconPlaceholder: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: '#0f3460',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  appIconEmoji: { fontSize: 24 },
  appCardInfo: { flex: 1 },
  appCardName: { fontSize: 16, color: TEXT_PRIMARY, fontWeight: '600' },
  appCardLimit: { fontSize: 13, color: ACCENT, marginTop: 2 },
  appCardMessage: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2, fontStyle: 'italic' },
  deleteButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2a1a2e', alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  deleteButtonText: { color: ACCENT, fontSize: 14, fontWeight: 'bold' },

  addButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', marginTop: 8, elevation: 3,
  },
  addButtonText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  infoNote: { color: TEXT_SECONDARY, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 18 },

  // Modal shared
  modalSafeArea: { flex: 1, backgroundColor: DARK_BG },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, backgroundColor: CARD_BG, elevation: 4,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: TEXT_PRIMARY },
  modalClose: { fontSize: 20, color: TEXT_SECONDARY, padding: 4 },

  // App picker
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, margin: 16, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: TEXT_PRIMARY, fontSize: 15 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: TEXT_SECONDARY, fontSize: 15 },
  appListItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: CARD_BG,
  },
  appListIcon: { width: 44, height: 44, borderRadius: 10, marginRight: 14 },
  appListIconPlaceholder: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: CARD_BG,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  appListInfo: { flex: 1 },
  appListName: { fontSize: 15, color: TEXT_PRIMARY, fontWeight: '500' },
  appListPackage: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  noResultsText: { color: TEXT_SECONDARY, textAlign: 'center', marginTop: 40, fontSize: 15 },

  // Time limit modal
  limitScrollView: { flex: 1, padding: 20 },
  sectionLabel: { fontSize: 16, fontWeight: 'bold', color: TEXT_PRIMARY, marginTop: 20, marginBottom: 6 },
  sectionHint: { fontSize: 13, color: TEXT_SECONDARY, marginBottom: 14, lineHeight: 18 },
  limitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  limitOption: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#3a3a5e',
    backgroundColor: CARD_BG,
  },
  limitOptionSelected: { borderColor: ACCENT, backgroundColor: '#2a1020' },
  limitOptionText: { color: TEXT_SECONDARY, fontSize: 14 },
  limitOptionTextSelected: { color: ACCENT, fontWeight: 'bold' },
  messageInput: {
    backgroundColor: CARD_BG, borderRadius: 10, padding: 14,
    color: TEXT_PRIMARY, fontSize: 14, lineHeight: 22,
    minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#3a3a5e',
  },
  charCount: { color: TEXT_SECONDARY, fontSize: 11, textAlign: 'right', marginTop: 4 },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
    marginTop: 28, elevation: 3,
  },
  saveButtonText: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: 'bold' },
});
