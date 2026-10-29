# Learning Notes — Mindful Reminder

This document tracks everything built in each milestone, explaining how it works in simple words so you can easily answer interview questions.

---

## Milestone M0: Project Housekeeping & Package Setup

### What We Built / Changed
1. **App Identity Configured:**
   - Updated `app.json` with the official app display name: **Mindful Reminder**
   - Updated the app slug: `mindful-reminder`
   - Configured the unique Android package name: `com.deepak.mindfulreminder`
2. **Project Documentation Organized:**
   - Created `docs/` folder containing `PROJECT_BRIEF.md`, `AGENTS.md`, and `LEARNING_NOTES.md`.

### How It Works (Simple Explanation)
- **`app.json`**: This is the main configuration file for Expo projects. When Expo generates native Android files (during `npx expo prebuild` or `npx expo run:android`), it reads `app.json` to configure the Android `AndroidManifest.xml` and `build.gradle` automatically.
- **Package Name (`com.deepak.mindfulreminder`)**: An Android package name is a unique ID for your app on the Google Play Store and on Android devices. No two apps on the Play Store can have the same package name. Once an app is published on the Play Store, its package name can **never** be changed.

---

### Interview Questions & Answers

#### Q1: What is the purpose of `app.json` in an Expo project?
> **Answer:** `app.json` is the central configuration file in Expo. It sets key app properties like app name, slug, version, icon, and native configuration (such as the Android package name). Expo uses `app.json` to generate native Android/iOS project files automatically.

#### Q2: Why is the Android package name important, and can it be changed after publishing?
> **Answer:** The package name (e.g., `com.deepak.mindfulreminder`) uniquely identifies an application on the Android device and Google Play Store. It cannot be changed after the app is published on Google Play because Play Store tracks app updates and user installs using this exact package name.

#### Q3: What is Continuous Native Generation (CNG) in Expo?
> **Answer:** Continuous Native Generation means that the native `android/` and `ios/` directories are automatically generated from project configurations (`app.json` and config plugins) rather than maintained manually. This allows easy Expo SDK upgrades and clean builds without managing complex native project files directly.
