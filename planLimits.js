// planLimits.js — Plan limits for App Time Notifier.
// Version 1 is 100% free with unlimited apps, no ads, and no payments,
// so people can try it without any friction and leave honest reviews.

export const FREE_APP_LIMIT = Infinity;

export function canAddApp() {
  return true;
}

export function isAppActiveForPlan() {
  return true;
}
