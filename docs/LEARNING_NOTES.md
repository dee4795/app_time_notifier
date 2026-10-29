# Learning Notes — App Time Notifier

This document tracks everything built in each milestone, explaining how it works in simple words so you can easily answer interview questions.

---

## Milestone M0: Project Housekeeping & Package Setup

### What We Built / Changed
1. **App Identity Configured:**
   - Updated `app.json` with the official app display name: **App Time Notifier**
   - Updated the app slug: `app-time-notifier`
   - Configured the unique Android package name: `com.deepak.apptimenotifier`
2. **Project Documentation Organized:**
   - Created `docs/` folder containing `PROJECT_BRIEF.md`, `AGENTS.md`, and `LEARNING_NOTES.md`.

### How It Works (Simple Explanation)
- **`app.json`**: This is the main configuration file for Expo projects. When Expo generates native Android files (during `npx expo prebuild` or `npx expo run:android`), it reads `app.json` to configure the Android `AndroidManifest.xml` and `build.gradle` automatically.
- **Package Name (`com.deepak.apptimenotifier`)**: An Android package name is a unique ID for your app on the Google Play Store and on Android devices. No two apps on the Play Store can have the same package name. Once an app is published on the Play Store, its package name can **never** be changed.

---

### Interview Questions & Answers

#### Q1: What is the purpose of `app.json` in an Expo project?
> **Answer:** `app.json` is the central configuration file in Expo. It sets key app properties like app name, slug, version, icon, and native configuration (such as the Android package name). Expo uses `app.json` to generate native Android/iOS project files automatically.

#### Q2: Why is the Android package name important, and can it be changed after publishing?
> **Answer:** The package name (e.g., `com.deepak.apptimenotifier`) uniquely identifies an application on the Android device and Google Play Store. It cannot be changed after the app is published on Google Play because Play Store tracks app updates and user installs using this exact package name.

#### Q3: What is Continuous Native Generation (CNG) in Expo?
> **Answer:** Continuous Native Generation means that the native `android/` and `ios/` directories are automatically generated from project configurations (`app.json` and config plugins) rather than maintained manually. This allows easy Expo SDK upgrades and clean builds without managing complex native project files directly.


---

## Milestone M1: Basic Working Home Screen

### What We Built / Changed

1. **Renamed the app** from "Mindful Reminder" to "App Time Notifier":
   - `app.json` — name and slug updated
   - `android/app/src/main/res/values/strings.xml` — the app label Android sees
   - `android/settings.gradle` — the Gradle project name
   - `package.json` — the npm package name
   - All docs updated

2. **Fixed Android permissions** in `AndroidManifest.xml`:
   - REMOVED `SYSTEM_ALERT_WINDOW` (overlay permission — not needed, violates our rules)
   - REMOVED `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` (will add back later properly)
   - ADDED `POST_NOTIFICATIONS` (needed on Android 13+ to send notifications)
   - ADDED `PACKAGE_USAGE_STATS` (needed to read how long each app was used)

3. **Built the home screen** in `App.js`:
   - Dark blue background with a header showing the app name
   - Empty state with emoji and helpful text when no apps are monitored
   - A red "Add App to Monitor" button (shows an alert for now)
   - State variable `monitoredApps` ready to hold the list later

### How It Works (Simple Explanation)

- `SafeAreaView` makes sure content does not go behind the phone's status bar or camera cutout.
- `ScrollView` lets the content scroll if the list of apps gets long.
- `useState([])` creates a "box" called `monitoredApps`. It starts empty. When we add apps later, React will automatically re-draw the screen with the new list.
- `StyleSheet.create({})` is like CSS for React Native. Instead of class names you use JavaScript object keys.
- The `TouchableOpacity` button becomes slightly transparent when you tap it — that gives the user visual feedback that the tap was registered.

### Interview Questions & Answers

#### Q1: What is `useState` and why do we use it here?
> **Answer:** `useState` is a React "hook" — a special function that lets a component remember data between renders. Here we use `useState([])` to remember the list of monitored apps. When the list changes, React automatically updates (re-renders) the screen so the user always sees the current list.

#### Q2: What is `SafeAreaView` and why is it important?
> **Answer:** `SafeAreaView` is a React Native component that automatically adds padding to avoid the phone's "unsafe" areas — like the status bar at the top, the camera notch, or the home-bar at the bottom. Without it, content might be hidden behind these areas on some phones.

#### Q3: Why did we remove `SYSTEM_ALERT_WINDOW` permission from the AndroidManifest?
> **Answer:** `SYSTEM_ALERT_WINDOW` allows an app to draw an overlay (popup) on top of all other apps. We do not need this because our app only sends notifications, not overlays. Keeping unnecessary permissions is a security risk and may cause Google Play to reject the app.


---

## Milestone M2: App Picker, Time Limit Setter, and AsyncStorage

### What We Built

1. **A `<queries>` entry for launcher apps** in `AndroidManifest.xml`:
   - Added an intent for `ACTION_MAIN` + `CATEGORY_LAUNCHER` so Android lets us ask "which apps show on the home screen?"
   - This does NOT need the dangerous `QUERY_ALL_PACKAGES` permission.

2. **A local Expo Module** (`modules/app-list-reader/`):
   - Kotlin file (`AppListReaderModule.kt`) that talks to Android's `PackageManager` to fetch launchable apps.
   - Each app returns its name, package name, and icon (as a Base64 PNG string).
   - JavaScript side (`index.ts`) exposes one function: `getInstalledApps()`.

3. **AsyncStorage** for saving data:
   - Installed `@react-native-async-storage/async-storage`.
   - Monitored apps are saved to the phone's local storage so the list survives app restarts.

4. **Full App.js rewrite** with two modals:
   - **App Picker Modal**: Shows all installed apps with icons and a search bar. Slides up when user taps "+ Add App to Monitor".
   - **Time Limit Modal**: After picking an app, the user picks a time limit (15 min → 3 hours) and types a personal notification message.
   - **Home screen cards**: Each monitored app shows as a card with icon, name, limit, message, and a delete button.

### How It Works (Simple Explanation)

- **PackageManager**: Android's built-in directory of all installed apps. We ask it "show me all apps with a LAUNCHER icon" — that is every app visible on the home screen.
- **Base64**: A way to turn an image (binary data) into plain text so we can send it from Kotlin to JavaScript. JavaScript turns it back into an image using `data:image/png;base64,...`.
- **AsyncStorage**: Like `localStorage` in web browsers but for React Native. It stores key-value pairs as strings on the phone's disk. We store the monitored apps list as a JSON string.
- **React Native Modal**: A full-screen component that slides over the current screen. We use `animationType="slide"` so it slides up from the bottom — feels natural on mobile.
- **Local Expo Module**: A small native (Kotlin) plugin we write ourselves. Expo's module system connects it to JavaScript automatically without us having to edit `MainApplication.kt` by hand.

### Interview Questions & Answers

#### Q1: Why do you use a local Expo module instead of a third-party library to list installed apps?
> **Answer:** Third-party libraries for listing apps often request `QUERY_ALL_PACKAGES`, which is a restricted permission that Google Play may reject unless we justify it. By writing our own small Kotlin module and declaring a `<queries>` block in the manifest with only the `LAUNCHER` intent, we get exactly the apps we need (home screen apps) without the dangerous permission. It also means fewer dependencies, which keeps the app smaller and easier to maintain.

#### Q2: What is `AsyncStorage` and how does it differ from a database?
> **Answer:** `AsyncStorage` is a simple key-value store built into React Native. You save a string under a key, and read it back later. It is good for small amounts of data like user settings or a short list of items. A database (like SQLite) is better for large amounts of structured data with relationships. For our app, `AsyncStorage` is enough because we store just a few monitored app records as a JSON string.

#### Q3: What is the React Native `Modal` component and why did we use it instead of a navigation library?
> **Answer:** `Modal` is a built-in React Native component that renders a full-screen overlay on top of everything else. We chose it over a navigation library (like React Navigation) because our app only has one real screen so far — adding a navigation library would be extra complexity that Deepak would need to explain in an interview. Using `Modal` keeps all code in one file (`App.js`), making it very easy to read and understand step by step.
