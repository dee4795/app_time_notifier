// index.ts — JavaScript side of our native module
// This is what App.js calls. It talks to the Kotlin code underneath.

import { requireNativeModule } from 'expo-modules-core';

const AppListReaderModule = requireNativeModule('AppListReader');

// InstalledApp is the shape of data we get back for each app
export interface InstalledApp {
  appName: string;        // Display name (e.g. "Instagram")
  packageName: string;    // Unique ID (e.g. "com.instagram.android")
  icon: string | null;    // Base64-encoded app icon (PNG)
}

/** Apps that appear on the Android home screen, sorted by name. */
export async function getInstalledApps(): Promise<InstalledApp[]> {
  return await AppListReaderModule.getInstalledApps();
}

/** true if the user has turned on "Usage access" for our app. */
export function hasUsageAccess(): boolean {
  return AppListReaderModule.hasUsageAccess();
}

/** Text for testing: what Android answered about Usage access. */
export function getUsageAccessDebug(): string {
  return AppListReaderModule.getUsageAccessDebug();
}

/** Opens the Android Settings page where the user turns on "Usage access". */
export function openUsageAccessSettings(): void {
  AppListReaderModule.openUsageAccessSettings();
}

/**
 * Minutes each app was on screen today (since local midnight).
 * Example result: { "com.instagram.android": 42, "com.whatsapp": 7 }
 */
export async function getTodayUsageMinutes(
  packageNames: string[]
): Promise<Record<string, number>> {
  return await AppListReaderModule.getTodayUsageMinutes(packageNames);
}
