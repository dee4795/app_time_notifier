// planLimits.js — All Free vs Pro rules live in one small file.
// Why keep them here? So the rules are easy to read, test, and explain
// without digging through screen code.

export const FREE_APP_LIMIT = 1;

/**
 * Can the user add another app right now?
 */
export function canAddApp(currentAppCount, isPro) {
  return isPro || currentAppCount < FREE_APP_LIMIT;
}

/**
 * Should the app at this position in the list be actively watched?
 * Why: if Pro expires or is turned off, we NEVER delete the user's extra apps.
 * We keep them saved and simply pause any app beyond FREE_APP_LIMIT.
 */
export function isAppActiveForPlan(index, isPro) {
  return isPro || index < FREE_APP_LIMIT;
}
