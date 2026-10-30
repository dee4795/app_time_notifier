// index.ts — JavaScript side of our native module
// This is what App.js calls. It talks to the Kotlin code underneath.

// requireNativeModule finds the native module by its Name("AppListReader") string
// This is the correct way for Expo SDK 45+ modules
import { requireNativeModule } from 'expo-modules-core';

const AppListReaderModule = requireNativeModule('AppListReader');

// InstalledApp is the shape of data we get back for each app
export interface InstalledApp {
  appName: string;        // Display name (e.g. "Instagram")
  packageName: string;    // Unique ID (e.g. "com.instagram.android")
  icon: string | null;    // Base64-encoded app icon (PNG)
}

/**
 * getInstalledApps()
 * Returns a list of all apps that appear on the Android home screen.
 * Sorted alphabetically by app name.
 */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  return await AppListReaderModule.getInstalledApps();
}
