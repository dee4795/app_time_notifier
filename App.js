// App.js — Main entry point for "App Time Notifier"
// This file is what the user sees when they open the app.

import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  ScrollView
} from 'react-native';
import { useState } from 'react';

export default function App() {
  // monitoredApps = list of apps the user is watching
  // useState starts with empty array (no apps yet)
  const [monitoredApps, setMonitoredApps] = useState([]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* Top header bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>App Time Notifier</Text>
        <Text style={styles.headerSubtitle}>Know when you've had enough</Text>
      </View>

      {/* Main scrollable content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Show message if no apps are being monitored yet */}
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
          // This will show the list of monitored apps later
          monitoredApps.map((app, index) => (
            <View key={index} style={styles.appCard}>
              <Text style={styles.appName}>{app.name}</Text>
            </View>
          ))
        )}

        {/* Button to add a new app to monitor */}
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            // TODO: Navigate to app picker screen (coming in next milestone)
            alert('App picker coming soon!');
          }}
        >
          <Text style={styles.addButtonText}>+ Add App to Monitor</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles ---
// Think of StyleSheet like CSS for React Native
const styles = StyleSheet.create({
  // The outer wrapper — takes full screen
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e', // dark blue background
  },

  // Top bar with title
  header: {
    backgroundColor: '#16213e',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    // Shadow for Android
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e94560', // accent red
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#a8a8b3',
    marginTop: 4,
  },

  // The scrollable area
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Empty state — shown when no apps are monitored
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
    padding: 20,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#a8a8b3',
    textAlign: 'center',
    lineHeight: 22,
  },

  // Card shown for each monitored app
  appCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  appName: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },

  // The main action button
  addButton: {
    backgroundColor: '#e94560',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
    // Shadow for Android
    elevation: 3,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

