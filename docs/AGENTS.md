# AGENTS.md — Rules for the AI coding agent (App Time Notifier app)

Read this file first. Then read `docs/PROJECT_BRIEF.md`.

## Who you are working with
- Developer: Deepak (Pune, India).
- Goals: Resume project for app development roles in Pune + paid Google Play Store app.
- Must be able to **explain every part of the code in an interview**.

## How to communicate
- Use **simple English**. Short sentences. No jargon without explanations.
- Work in **small steps**. After each step explain: what changed, why, and how to test on phone.
- Add comments explaining **why**, not only what.
- After each milestone, update `docs/LEARNING_NOTES.md`.

## Hard rules
1. No blocking of apps (no Accessibility Service).
2. Do not request `QUERY_ALL_PACKAGES`.
3. No overlay permission (`SYSTEM_ALERT_WINDOW`).
4. No backend for version 1. All data stays on the phone.
5. Do not edit generated files in `android/` by hand. Use Expo config plugins or local Expo modules.
