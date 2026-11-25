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

---

## Milestone M3: Usage Time, Photo Picker, and Rules Storage

### What We Built

1. **Usage time reading** (Kotlin `UsageReader.kt`):
   - Uses Android's `UsageStatsManager` to read how long each app was on screen today.
   - Works by reading a log of events ("Instagram came to front at 10:00", "Instagram went back at 10:05") and adding up the time between each "front" and "back" event since midnight.
   - Shows the result as a progress bar on each monitored app card.

2. **Usage access permission flow**:
   - Android requires the user to grant "Usage access" in Settings. It cannot be asked as a pop-up — the user must go to Settings themselves.
   - We show an explanation screen first (required by Google Play policy) and then open the Settings page.
   - After returning from Settings, the app checks the permission again automatically.

3. **Photo picker and private storage** (Kotlin `AppListReaderModule.kt` — `savePhoto`):
   - The user picks a photo from their gallery using the system photo picker (`expo-image-picker`).
   - The picker gives us a temporary URI. We immediately copy the photo into our app's private folder (`filesDir/photos/`) so it stays even if the original is deleted.
   - While copying, we also make the photo smaller (at most 1600 pixels wide) and rotate it upright if needed (some phones save photos sideways with an EXIF rotation note).
   - Photos never leave the phone.

4. **Rules saved on the phone** (AsyncStorage):
   - Each monitored app's data (app name, package name, limit, message, photo path) is saved as JSON in AsyncStorage.
   - The list survives closing the app and restarting the phone.

### How It Works (Simple Explanation)

- **UsageStatsManager**: Android's built-in system that tracks app usage. Only available if the user grants "Usage access" in Settings. Apps need this permission because usage data is sensitive (it shows what apps you use and for how long).
- **EXIF data**: Hidden information inside a photo file — things like the camera model, date taken, and rotation. We use it to detect if a photo is sideways and rotate it before saving.
- **App private storage (`filesDir`)**: Every Android app has its own private folder. Only our app can read it. No other app or user can access it. The files are deleted when the app is uninstalled.
- **System photo picker**: Android's built-in photo picker. The user picks a photo and Android gives us temporary access. We do NOT need storage permission (`READ_EXTERNAL_STORAGE`) because Android handles the access for us. This is the modern, safe way to pick photos.

### Interview Questions & Answers

#### Q1: How does the app read how long an app was used today?
> **Answer:** We use Android's `UsageStatsManager` with `queryEvents()`. This gives us a log of events — when each app came to the foreground and when it went to the background. We loop through the events since midnight, adding up the time between each "came to front" and "went to back" pair. The result is the total screen time for that app today. We reset at midnight by using today's date as the starting point for the query.

#### Q2: Why do you copy the photo to the app's private folder instead of saving the original URI?
> **Answer:** The system photo picker gives us a temporary URI that may stop working later (if the user moves, renames, or deletes the original photo, or if Android revokes our temporary access). By copying the photo immediately into our app's private folder (`filesDir/photos/`), we own a permanent copy that always works as long as our app is installed. We also resize and rotate it at this step, so we only do that expensive work once.

#### Q3: What is "Usage access" and why can't we ask for it like a normal permission?
> **Answer:** "Usage access" (`PACKAGE_USAGE_STATS`) lets an app see which other apps the user has opened and for how long. Android treats this as a very sensitive permission — it cannot be granted with the normal runtime pop-up. Instead, Android opens a special Settings screen where the user manually turns on a switch. Our app shows an explanation screen first (telling the user why we need it and that the data never leaves the phone) and then opens that Settings screen. This explanation is required by Google Play policy.

---

## Milestone M4: Background Reminders and Notifications

### What We Built

1. **Foreground service** (`UsageWatchService.kt`):
   - A background service that checks app usage every 30 seconds.
   - Android only allows an app to run reliably in the background if it shows a small permanent notification. This is called a "foreground service". Ours shows "Watching your app limits".
   - Every 30 seconds it reads the watch list, checks usage, and sends a reminder if the limit is reached.
   - Uses `START_STICKY` — if Android kills the service (rare), Android restarts it automatically.

2. **Boot receiver** (`BootReceiver.kt`):
   - If the phone restarts, the watcher service stops (all services stop on reboot).
   - `BootReceiver` listens for the `BOOT_COMPLETED` broadcast and restarts the service.
   - It only restarts if the user has at least one app in the watch list AND usage access is on. No point running if there is nothing to watch.

3. **Reminder notification with photo** (`ReminderNotifier.kt`):
   - Sends a "Big Picture" style notification — a small version when folded, and the user's photo + message when opened.
   - Each monitored app gets exactly one reminder per day. We store the date the reminder was sent. If today's date matches the stored date, we skip. After midnight the date changes, so reminders reset automatically.
   - The notification opens our app when tapped.

4. **Notification permission** (Android 13+):
   - Android 13 and newer require the app to ask for `POST_NOTIFICATIONS` permission at runtime (like asking for camera access).
   - We ask when the user saves their first monitored app, with a friendly explanation first.

5. **Test reminder button**:
   - Each app card has a "Send test reminder" button. Tapping it fires the notification immediately so the user can see how it looks with their photo and message.

### How It Works (Simple Explanation)

- **Foreground service**: A special kind of background task. Normal background tasks are stopped by Android after a few minutes. A foreground service is allowed to keep running because it shows a notification — Android treats it like something the user knows is happening.
- **`START_STICKY`**: When Android returns `START_STICKY` from `onStartCommand`, it tells Android: "If you have to stop this service, please restart it when you have resources again."
- **`HandlerThread`**: A background thread with its own message queue. We run the usage check on this thread so the phone's screen never freezes during the check (reading usage stats can be slow).
- **Notification channel**: Android 8+ groups notifications into "channels". Users can mute or change the sound for each channel. We have two: one for the permanent "Watching" notice (low importance, no sound) and one for the reminder (high importance, with sound).
- **`todayKey()`**: Returns today's date as a string like `"2026-11-25"`. We save this when a reminder fires. After midnight it becomes `"2026-11-26"`, so the reminder can fire again — that is the daily reset.

### Interview Questions & Answers

#### Q1: What is a foreground service and why does this app need one?
> **Answer:** A foreground service is an Android component that keeps running in the background while showing a small permanent notification. Normal background work is limited — Android may stop it after a few minutes. A foreground service is allowed to run continuously because the user can see it is running (through the notification). Our app needs this because we must check app usage every 30 seconds all day, which is not possible with limited background tasks.

#### Q2: How does the app ensure the reminder only fires once per day?
> **Answer:** We use a simple date string as the key. When a reminder fires, we save today's date (e.g., `"2026-11-25"`) in `SharedPreferences` for that app's package name. Before sending the next reminder, we compare today's date with the saved date. If they are the same, we skip. After midnight the date becomes `"2026-11-26"`, so the check passes and the reminder can fire again the next day.

#### Q3: What happens to the background service when the phone restarts?
> **Answer:** Android stops all services when the phone restarts. We handle this with a `BroadcastReceiver` called `BootReceiver`. It listens for the `ACTION_BOOT_COMPLETED` broadcast that Android sends after the phone finishes booting. When we receive it, we check if there are apps to watch and if usage access is still on. If yes, we restart the foreground service. This way, reminders keep working without the user having to open the app after a restart.

---

## Milestone M5: Reliability and Debug Screen

### What We Built

1. **Midnight reset — verified correct**:
   - The `todayKey()` function in `NotifierStore.kt` returns the current date in `"yyyy-MM-dd"` format using `Locale.US` (always consistent, never affected by phone language settings).
   - The service naturally resets at midnight because the date string changes. No extra code needed.

2. **`isWatching()` function** (Kotlin + JS):
   - Added a `companion object` to `UsageWatchService` with an `isRunning` boolean.
   - Set to `true` in `onCreate`, `false` in `onDestroy`.
   - Exposed through `AppListReaderModule` as `isWatching()`.
   - Now JavaScript can ask "is the service running right now?" at any time.

3. **Debug screen** (`App.js`):
   - A `DebugPanel` component that reads and displays: service running, usage access, notifications, today's usage minutes for each app, and today's reset key.
   - Shown with a small "🛠 Debug" button at the bottom of the screen.
   - Only visible in development builds (`__DEV__ === true`). The button and panel are completely removed in release builds automatically.

### How It Works (Simple Explanation)

- **`companion object`**: In Kotlin, a `companion object` is like a `static` field in Java. It belongs to the class itself, not to one instance. So `UsageWatchService.isRunning` can be read from anywhere in the app without having a reference to a specific service object.
- **`__DEV__`**: A React Native global variable. It is `true` when running a development build (connected to Metro, using `npx expo start`). It is `false` in a release build. When React Native compiles a release build, it removes all code inside `if (__DEV__) { ... }` blocks — the debug panel code does not exist in the final APK/AAB.
- **Why `Locale.US` for the date format?** Some phone languages use different calendar systems (e.g., Persian or Arabic). `Locale.US` forces the date to always be in the Gregorian calendar with digits 0-9, so the date string is always consistent regardless of the phone's language setting.

### Interview Questions & Answers

#### Q1: What is `__DEV__` in React Native and why is it useful?
> **Answer:** `__DEV__` is a global boolean that React Native sets to `true` in development builds and `false` in production (release) builds. We use it to show a debug panel only while testing — `{__DEV__ && <DebugPanel />}`. In a release build the Metro bundler removes this code entirely, so the debug panel never reaches the user. This is safer than a feature flag in a config file because there is literally no debug code in the production app.

#### Q2: What is a `companion object` in Kotlin?
> **Answer:** A `companion object` is Kotlin's way of having class-level (static) properties and functions. Code inside it belongs to the class, not to any specific instance. We use it to store `isRunning` on `UsageWatchService` so that any code — including the Kotlin module talking to JavaScript — can read the service's current state without needing a reference to the running service object.

#### Q3: Why use `Locale.US` when formatting the date in `todayKey()`?
> **Answer:** `SimpleDateFormat` uses the phone's current locale by default. Some locales use different digit systems (e.g., Arabic uses ٠١٢٣ instead of 0123) or different calendars. If the date format changes, the daily reset logic breaks — a reminder might fire twice or not at all. By forcing `Locale.US`, we always get a consistent `"yyyy-MM-dd"` string regardless of the user's phone language.

