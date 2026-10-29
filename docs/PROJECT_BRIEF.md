# Project Brief — "App Time Notifier"

Last updated: October 2026
Status: **Setup and Milestone M0 initialized.**

## 0. How to use this file

- For the AI agent: read `AGENTS.md` first, then this file. This file is the single source of truth.
- Tags used in this file:
  - **DECIDED** — final decision by the developer.
  - **SUGGESTED** — a recommendation, not approved yet. Ask before treating it as final.
  - **OPEN** — not decided.
  - **VERIFY** — comes from memory or secondary sources. Check it against official documentation.

## 1. Summary (in plain words)

The developer wants an Android app that helps people spend less time on distracting apps. The user chooses an app (for example Instagram) and a time limit. When the user reaches the limit, the app sends a notification with the user's own message and a photo of a loved one from their family. The idea is a personal, caring reminder, not a lock or a block.

The app is free for 1 monitored app. More apps and extra features need a paid upgrade.

## 2. Goals

1. **Resume project.** The developer is job searching for app development roles in Pune. The app must be a real, finished, published project that he can explain.
2. **Income.** Earn money from the paid upgrade.
3. **Publish on Google Play** as a working, polished app.

## 3. About the developer and how to work with him

- Name: Deepak. Lives in Pune, Maharashtra.
- Wants explanations a non-technical person can follow. Use simple English and short sentences.
- Works on Windows laptop with a real Android phone connected over USB.

## 4. Product definition

- **App Name:** App Time Notifier (DECIDED)
- **Package Name:** `com.deepak.mindfulreminder` (DECIDED)
- **Core idea:** User picks apps to watch + time limit. When reached, receives a notification with custom text & loved one's photo.
- **Free vs Paid:** Free = 1 app forever; Paid = unlimited apps + extra features.

## 5. Technical Stack

- Expo SDK 58, React Native 0.88, JavaScript, Android Development Build (`npx expo run:android`).
- Native Kotlin module for Android Usage Access (`PACKAGE_USAGE_STATS`).
