# Project Brief — "Focus Reminder" (working name)

Last updated: 27 October 2026
Status: **Setup is finished. The first test build runs on the developer's phone. No app features are written yet.**

## 0. How to use this file

- For the AI agent: read `AGENTS.md` first, then this file. This file is the single source of truth.
- Tags used in this file:
  - **DECIDED** — final decision by the developer.
  - **SUGGESTED** — a recommendation, not approved yet. Ask before treating it as final.
  - **OPEN** — not decided.
  - **VERIFY** — comes from memory or secondary sources (blogs, a few web pages). Check it against official documentation (Android developer docs, Google Play Console help, Expo docs) before relying on it.
- If something here conflicts with the official docs, the official docs win. Tell the developer.

## 1. Summary (in plain words)

The developer wants an Android app that helps people spend less time on distracting apps. The user chooses an app (for example Instagram) and a time limit. When the user reaches the limit, the app sends a notification with the user's own message and a photo of a loved one from their family. The idea is a personal, caring reminder, not a lock or a block.

The app is free for 1 monitored app. More apps and extra features need a paid upgrade.

## 2. Goals

1. **Resume project.** The developer is job searching for app development roles in Pune. The app must be a real, finished, published project that he can explain.
2. **Income.** Earn money from the paid upgrade. Be realistic: this may earn little. The resume value is the sure win.
3. **Publish on Google Play** as a working, polished app.

## 3. About the developer and how to work with him

- Name: Deepak. Lives in Pune, Maharashtra. Speaks Marathi and English.
- Education: B.Sc. Computer Science (SPPU). Has a MEAN stack certification. Knows JavaScript and React basics.
- **Today he relies on AI to write most code.** He wants to learn enough to explain every part in an interview. So: explain simply, go step by step, and write learning notes.
- Wants explanations a non-technical person can follow. Use short sentences.
- Works alone from home. Prefers online, text-based research. Do not suggest in-person outreach as a required step.
- Device facts: Windows laptop with about 12 GB RAM (do not rely on the Android emulator; use the real phone). Phone: Moto G57 Power (Android), USB debugging works.
- Projects live on the **D: drive** (`D:\dev`). The C: drive keeps Android Studio, the SDK, and the Gradle cache.

## 4. How we got here (decision history)

1. The developer asked which app would get the most downloads. Answer: downloads are not money; paying users are.
2. Research on small-business niches in Pune/Maharashtra. These were **rejected as crowded or weak**: MPSC/police-bharti exam prep, festival poster makers, a government-scheme finder (the government is building its own portal), tailor/boutique apps, and generic billing apps. A "daily delivery ledger" for tiffin/milk/water vendors was the best B2B lead, but it needs outreach to vendors, so it was set aside.
3. The developer chose to solve **his own problem: the phone is his biggest distraction.**
4. **DECIDED:** Do **not** block apps. (Blocking needs an Accessibility Service, which has heavy Google Play rules.) Instead, send a reminder after the user spends a set time in an app.
5. **DECIDED:** The reminder shows a custom message and a photo of a loved one.
6. **DECIDED:** Free plan = **1 monitored app, forever**. Paying is needed for more than 1 app. The 7-day trial idea was dropped.
7. **DECIDED:** Build with **React Native + Expo (development build)**, Android only.
8. **OPEN:** Final prices. Earlier ideas: ₹19 monthly, ₹49 yearly, ₹99 lifetime. We found these are too low and the monthly price makes the yearly price pointless. See section 11.

## 5. Product definition

### 5.1 Core idea
- The user picks one or more apps to watch and sets a time limit for each.
- The app reads how long each watched app was used today.
- At the limit, the app sends a notification with the user's own text and photo.
- The photo and message are stored only on the phone.

### 5.2 Target users (SUGGESTED)
People in India who lose time on social apps. Possible sharper focus: job seekers and students preparing for jobs or exams. This is a guess, not tested.

### 5.3 Free vs paid
| Feature | Free | Premium |
|---|---|---|
| Watched apps | **1 (DECIDED)** | Unlimited (DECIDED) |
| Reminder with own message + own photo | Yes | Yes |
| One time limit per app | Yes | Yes |
| Several reminder levels (for example 30, 60, 90 min) | No | Yes (SUGGESTED) |
| Several photos that rotate | No | Yes (SUGGESTED) |
| Weekly report ("you spent X hours less than last week") | No | Yes (SUGGESTED) |
| English + Marathi interface | Yes | Yes |

The free version must still be **good and complete for one app**, because happy free users leave the reviews that help new users find the app.

### 5.4 Screens (SUGGESTED)
1. **Onboarding** — explains what the app does and why it needs "Usage access". Contains the prominent disclosure text (see 5.6).
2. **Home** — list of watched apps with today's usage versus the limit. Button "Add app".
3. **Add/Edit app** — choose the app, set the limit, write the message, pick the photo(s).
4. **Settings** — language, notification test button, help for battery settings, privacy policy link.
5. **Upgrade (paywall)** — shown only when the user tries to add a second app or open a premium feature. Friendly, not pushy.
6. **Weekly report** (premium).
7. **Debug screen** (development only) — shows the last usage numbers and the last notification sent.

### 5.5 Notification rules
- Use the user's message. If empty, use a gentle default.
- Default English: `You have spent {minutes} minutes on {app} today. Take a break. Someone is waiting for you.`
- Default Marathi: `आज तुम्ही {app} वर {minutes} मिनिटे घालवली. थोडा ब्रेक घ्या.`
- Do **not** write medical claims such as "this is bad for your health" as default text. Google Play can be strict about misleading health claims, and the user can write their own words. (VERIFY policy.)
- Send each level only **once per day per app**. Reset at local midnight.
- The photo appears in the notification (large picture style).
- Tone: caring, not scary. Too much guilt makes people uninstall.

### 5.6 Required explanation before asking for Usage access (prominent disclosure)
Show this text on a screen **before** sending the user to the Android setting. Wording can be improved, but the meaning must stay. (VERIFY current Google Play requirements.)

> "This app uses 'Usage access' to see how long you use the apps you choose, so it can send you a reminder. This information stays on your phone. It is never uploaded or shared."

### 5.7 Data model (SUGGESTED, stored on the phone)
```
Rule {
  id, packageName, appLabel, enabled,
  levelsMinutes: [30]            // free: one level; premium: up to 3
  messages: ["..."],             // user text, any language
  photoPaths: ["file path in app private storage"]
}
Settings { language }
Entitlement { isPremium, lastVerifiedAt }
DailyState { date, firedLevels: { packageName: [30, 60] } }
```

## 6. Technical design

### 6.1 Stack (DECIDED)
- Expo SDK 58, React Native 0.88, JavaScript (blank template). TypeScript is OPEN (SUGGESTED: stay in JavaScript for now, consider TypeScript later).
- Development build via `npx expo run:android`. **Expo Go cannot run this app** because it needs custom native Android code.
- Android only. No iOS (iOS does not give per-app usage time to normal apps).

### 6.2 IMPORTANT: native code must survive regeneration
Expo can regenerate the `android/` folder (`npx expo prebuild --clean`). Hand edits inside `android/` can be lost.
- First check `.gitignore`. If `/android` is ignored, the folder is generated. (VERIFY)
- Put Kotlin code in a **local Expo module** (for example `modules/usage-access/`) and use a **config plugin** for manifest changes. (VERIFY the current Expo docs: "Expo Modules API", "create a local module", "config plugins".)
- Explain to the developer what these are, in plain words.

### 6.3 Native module functions (SUGGESTED)
| Function | What it does |
|---|---|
| `hasUsageAccess()` | Is the special "Usage access" permission turned on? |
| `openUsageAccessSettings()` | Opens the Android settings screen where the user turns it on |
| `getLaunchableApps()` | Returns app name, package name, and icon for apps the user can launch |
| `getTodayUsageMinutes(packageName)` | Minutes the app was in the foreground since local midnight |
| `saveRules(json)` | Stores the rules where the background service can read them |
| `startMonitoring()` / `stopMonitoring()` / `isMonitoring()` | Controls the background checker |
| `sendTestNotification(ruleId)` | Shows the reminder right now (for testing) |

### 6.4 Reading usage (VERIFY all of this in the Android docs)
- Permission: `PACKAGE_USAGE_STATS` in the manifest. The user grants it in Settings (Usage access). Check with `AppOpsManager`.
- Prefer `UsageStatsManager.queryEvents()` and add up the time between "app moved to foreground" and "app moved to background" events since midnight. It is usually more exact than daily summaries. Test both against the phone's Digital Wellbeing numbers.
- The numbers will not match other apps exactly. Show the app's own number and keep the logic simple.

### 6.5 Listing apps without a restricted permission
- Do **not** use `QUERY_ALL_PACKAGES` (Google Play restricts it). (VERIFY)
- Use a `<queries>` element with an intent for `MAIN` + `LAUNCHER`, then `PackageManager.queryIntentActivities`. (VERIFY)

### 6.6 Background monitoring — two options (OPEN; pick one with the developer)
- **Option A — Foreground service** with a small permanent notification. It checks usage about every 30–60 seconds, and only while the screen is on. More exact timing. Needs a foreground-service **type** and a Play Console declaration. (VERIFY which type fits, for example `specialUse`, and what Google requires.)
- **Option B — WorkManager periodic work.** Lighter on the battery and simpler for Play, but Android runs it at most about every 15 minutes, so reminders can be late. (VERIFY)
- SUGGESTED: start with Option A for accuracy; keep Option B as a fallback if Play review is difficult.
- Handle: restart after reboot (`RECEIVE_BOOT_COMPLETED`, VERIFY background-start limits on new Android versions), battery optimisation, phones that kill background apps.

### 6.7 Notifications
- Android 13 and newer: ask for `POST_NOTIFICATIONS` at runtime, with a friendly explanation first.
- Create a notification channel (for example "Reminders").
- Show the photo with a big-picture style. Decode a **small** version of the image to avoid memory errors.
- Tapping the notification opens the app.

### 6.7b Photos
- Use the system photo picker (for example `expo-image-picker`). It needs no storage permission. (VERIFY)
- Copy the chosen photo into the app's private storage right away, so it still works if the original is deleted. Save only the new file path.
- Never upload photos.

### 6.8 Storage
- The native service must read the rules, so the native side stores them (for example in app private storage or SharedPreferences as JSON), written by the JavaScript side through `saveRules`. (SUGGESTED)

### 6.9 Billing and unlocking
- Use **Google Play Billing**. Library choice is OPEN: for example `react-native-iap`, `expo-iap`, or RevenueCat. (VERIFY current status, Expo SDK 58 support, and cost.) Ask the developer before choosing.
- Products (SUGGESTED): one yearly subscription and one one-time "lifetime" purchase. Set prices in Play Console, not in code.
- Gating rule: a free user can have **1** active rule. Adding a second shows the upgrade screen. Never delete a user's data when they are over the limit; keep it saved and just disable the extra rules.
- Store a cached entitlement so the app works offline. Re-check with Google Play when the app opens. Support "Restore purchases".
- Keep the gating logic in one small, testable function.

### 6.10 Languages
- English and Marathi interface. User messages can be in any language (Unicode). Keep all text in one strings file.

### 6.11 Privacy and policy (VERIFY every item)
- All data stays on the phone. No account, no server, no ads in version 1.
- A public **privacy policy** page is required for the Play listing. A free option: GitHub Pages.
- Fill the Play **Data safety** form honestly (check what the billing library collects).
- A **permissions declaration** may be required for Usage access and for the foreground service.

### 6.12 Edge cases to handle
- Midnight reset and time-zone or clock changes.
- Phone reboot; app update; the watched app is uninstalled.
- Usage access turned off later; notification permission denied.
- Battery saver and phone-maker background limits (show a help screen).
- Two reminders firing at once; reminders while the phone is locked.

## 7. Environment (already set up — do not redo)

| Item | Value |
|---|---|
| OS | Windows (use **PowerShell**; `echo %VAR%` does not work, use `$env:VAR`) |
| Node / npm | v24.19.0 / 11.17.0 |
| Java | Microsoft OpenJDK 17.0.21 at `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`; `JAVA_HOME` is set |
| Android Studio | 2026.2.1.8 (stable) |
| Android SDK | `C:\Users\deepa\AppData\Local\Android\Sdk`; `ANDROID_HOME` is set; `platform-tools` is on PATH |
| SDK pieces installed by the first build | Platform 37, Build-Tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1 |
| Gradle / Kotlin | Gradle 9.4.1, Kotlin 2.2.10 |
| App build values | minSdk 24, targetSdk 36, compileSdk 37 |
| Phone | USB debugging on, authorized, shows as `device` in `adb devices` |
| Project | `D:\dev\focus-reminder` |
| First build | Succeeded in about 8 minutes; the app installed and opened on the phone |

Notes:
- A "hard link failed, doing a slower copy" message is harmless. The project is on D: and the Gradle cache is on C:.
- A long list of "deprecated" warnings during builds is normal. Do not "fix" them unless something fails.
- Java 23 was removed on purpose. Use JDK 17.

## 8. Current project state

- Created with `npx create-expo-app@latest focus-reminder --template blank`, then built with `npx expo run:android`.
- Package name is still the placeholder `com.anonymous.focusreminder`. **Change it before the first Play upload. It cannot be changed after publishing.**
- Git and GitHub are **not set up yet** (first task, see M0).
- No features exist yet.

## 9. Build plan (milestones)

Working time is about 1–2 hours per day. Each milestone must run on the real phone before moving on. After each one, update `docs/LEARNING_NOTES.md`.

### M0 — Housekeeping (1–2 days)
- Initialise Git, check `.gitignore`, create the GitHub repository, push.
- Choose the final **package name** (lowercase, no spaces, for example `com.<yourname>.<appname>`) and the app name. Set them in `app.json`. Uninstall the old test app from the phone, then rebuild. (VERIFY the exact Expo steps.)
- Add this brief and `AGENTS.md` to the repo.
- Done when: the app runs with the new name and the code is on GitHub.

### M1 — Screens with fake data (3–5 days)
- Navigation, Home, Add/Edit, Settings, Upgrade screens, using fake data.
- English + Marathi strings file.
- Done when: the user can move through all screens on the phone.

### M2 — Usage access module (4–6 days)
- Create the local Expo module. Implement `hasUsageAccess`, `openUsageAccessSettings`, `getLaunchableApps`, `getTodayUsageMinutes`.
- Show the disclosure screen, then open the Android setting.
- Show today's usage for a chosen app.
- Done when: the number is close to what the phone's Digital Wellbeing shows.

### M3 — Rules, storage, photo (4–6 days)
- Add, edit, delete one rule. Pick the photo and copy it to private storage. Save and reload rules after restarting the app.
- Done when: rules survive closing the app and restarting the phone.

### M4 — Reminder notification (5–7 days)
- `sendTestNotification` with message and photo.
- Background monitoring (Option A or B). Send the reminder at the limit, once per level per day. Test with a 1-minute limit.
- Notification permission flow for Android 13+.
- Done when: using the chosen app for the limit time sends the reminder with the photo, even when the screen was off in between.

### M5 — Reliability (3–5 days)
- Restart after reboot, midnight reset, permission-revoked handling, battery help screen, debug screen.
- Done when: it keeps working for a full day without opening the app.

### M6 — Free/paid logic (3–5 days)
- Gating function, upgrade screen, a **fake** "premium" switch for testing.
- Premium extras: levels, rotating photos, weekly report.
- Done when: free users are limited to 1 app and the fake switch unlocks everything.

### M7 — Real billing (5–7 days)
- Create products in Play Console (needs an uploaded build; see section 10). Use license testers. Purchase, restore, offline behaviour.
- Done when: a test purchase unlocks premium and survives reinstalling.

### M8 — Polish and compliance (5–7 days)
- Icon, splash screen, screenshots, privacy policy page, store text in English and Marathi, accessibility basics.
- Test a **release build** (R8 is on by default in release builds, so make sure the native module is not stripped; add keep rules if needed). (VERIFY)
- Done when: the release build behaves exactly like the debug build.

### M9 — Release (about 3 weeks including the required test period)
- See section 10.

## 10. Google Play release checklist (VERIFY every item in Play Console help)

1. **Developer account.** One-time fee (US$25 at the time of research). Identity verification is required.
2. **Closed testing rule.** Personal accounts created after 13 November 2023 had to run a closed test with at least 12 testers for 14 continuous days before applying for production. Organisation accounts were exempt but need business verification. **This rule may have changed. Check the current policy first.**
   - Plan this early: it adds about 2–3 weeks.
   - Get testers by message from friends, family, and classmates.
3. **Package name** final (M0).
4. **Signing.**
   - Create an **upload keystore** with `keytool` (it is inside the JDK 17 `bin` folder). Store it **outside the repo** (for example `D:\secrets\`) and **back it up**. Never commit it or its passwords.
   - Use **Play App Signing** (Google keeps the final app-signing key).
   - Two ways to build the release file (OPEN; VERIFY Expo docs): local Gradle build (`cd android` then `.\gradlew.bat bundleRelease`, output is an `.aab` file) or Expo's cloud build service (EAS Build; check the free-tier limits). Try local first.
5. **App content forms:** privacy policy URL, Data safety, content rating, target audience, ads declaration (no ads), and any permissions or foreground-service declarations Google asks for.
6. **Target API level.** New apps must target a recent Android version. The project currently targets 36. (VERIFY the current Play requirement before upload.)
7. **Store listing** (VERIFY the current limits): app name, short description, full description, app icon, feature graphic, and phone screenshots. Write English and Marathi versions.
8. **Payments.** Set up the payments profile in Play Console (India). Create the subscription and the one-time product. Set prices there. Ask a CA about tax.
9. **Release steps:** internal testing → closed testing (with the required testers and days) → apply for production → staged rollout (for example 20%, then 100%).
10. **After launch:** read reviews, watch crash reports (Play Console "Android vitals"), and ship small fixes quickly.

Honesty note: Google's review can ask questions about Usage access and the foreground service. Answer clearly: the data stays on the phone and is used only to send the reminder the user asked for.

## 11. Pricing and money (OPEN — financial figures here are rough)

- These are rough examples, not financial advice. Verify all fees in Play Console and ask a CA about tax.
- Google's fee at the time of research: about 15% for subscriptions, with a possible separate billing fee. (VERIFY)
- Why the earlier prices need a change:
  - ₹19 monthly = ₹228 a year, but the yearly price was ₹49. Nobody would pick monthly.
  - A ₹99 lifetime price equals only about 2 years of the yearly price and brings no repeat income.
  - After a 15% fee, ₹99 leaves about ₹84. About 120 lifetime sales a month would be needed for ₹10,000.
- **SUGGESTED test prices (not tested):** yearly ₹149–₹199, lifetime ₹299–₹399. Offer only these two. Prices can be changed later.
- Expect about 1–5 in every 100 free users to pay (a rough guess). Success depends on getting many installs.
- Getting installs without meeting people: a clear Play Store title and description in English and Marathi, good screenshots, helpful reviews, and posts in online communities. Be honest in all marketing.

## 12. Risks

1. **Crowded market.** Android has built-in Digital Wellbeing and there are many free focus apps. The personal photo + own message is the differentiator.
2. **Google Play review** of Usage access and the foreground service.
3. **Phone makers kill background apps.** Reminders may be late on some phones.
4. **Low willingness to pay** in India for this kind of app.
5. **The 12-tester, 14-day rule** can delay launch (if it still applies).
6. **Developer understanding.** If AI writes code the developer cannot explain, the resume value is lost. Follow the learning-notes rule.

## 13. Open decisions

- App name and package name.
- Final prices and billing library.
- Foreground service (A) or WorkManager (B).
- Which premium extras are really paid (levels, rotating photos, weekly report).
- JavaScript or TypeScript.
- Whether to launch with Marathi + English or English only.

## 14. Resume and interview guidance

- List only skills the developer can explain.
- Put real numbers only when true (for example the number of testers or installs).
- Sample line (fill in only true facts): "Built and published an Android app (React Native, Expo, native Kotlin module) that reads app-usage time and sends personalised reminders with the user's own photo. Implemented a free/paid plan with Google Play Billing."
- Be ready to explain: what a development build is, why Usage access is needed, how the background checker works, how photos are stored privately, how free/paid gating works, and what the privacy approach is.
- Keep the GitHub repository clean: a good README with screenshots, clear commits, and no secrets.

## 15. Starter prompts for the AI agent

**First message (do not write code yet):**
> Read AGENTS.md and docs/PROJECT_BRIEF.md. In simple English, tell me what this project is, what is already done, and what you will do in Milestone M0. Do not write code yet. List any facts you are unsure about. Then wait for my answer.

**Starting a milestone:**
> Start Milestone M2 from docs/PROJECT_BRIEF.md. First explain the plan in simple words and list the files you will create or change. Wait for my OK. Then work in small steps and tell me how to test each step on my phone.

**After a milestone:**
> We finished this milestone. Update docs/LEARNING_NOTES.md with a simple explanation of what we built and 3 interview questions with short answers. Then suggest the git commit message.

**When something fails:**
> Here is the exact error (last 30 lines). Explain what it means in simple words, give the most likely cause, and the smallest fix. Do not change unrelated files.
