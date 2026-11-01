package expo.modules.applistreader

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import java.util.Calendar

// Android's usage events use simple numbers for "app came to the front" (1)
// and "app went to the background" (2). We use the numbers directly so the
// code works on old and new Android versions without deprecation warnings.
private const val EVENT_APP_IN_FRONT = 1
private const val EVENT_APP_IN_BACK = 2

// UsageReader — everything about "how long was an app used today".
// Both the screen (through the module) and the background service use it,
// so the numbers are always the same.
object UsageReader {

  // Android answers with a number: 0 = allowed, 1 = ignored, 2 = errored,
  // 3 = default ("look at the normal permission instead").
  fun readMode(context: Context): Int {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName
      )
    }
  }

  fun hasAccess(context: Context): Boolean {
    val mode = readMode(context)
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      // Some phones answer "default". Then the normal permission decides.
      context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  fun debugText(context: Context): String {
    val mode = readMode(context)
    val permission =
      context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    return "mode=$mode (0=allowed,1=ignored,2=errored,3=default), permissionGranted=$permission"
  }

  // Minutes each app was on screen since midnight (phone's local time).
  // How it works: Android keeps a log of events ("Instagram came to front at
  // 10:00", "Instagram went to back at 10:05"). We add up the time between
  // each "front" and the next "back". One pass over the log handles all apps.
  fun todayMinutes(context: Context, packageNames: Collection<String>): Map<String, Int> {
    val wanted = packageNames.toSet()
    val usageStatsManager =
      context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    // Local midnight = start of "today"
    val calendar = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    val startOfDay = calendar.timeInMillis
    val now = System.currentTimeMillis()

    val events = usageStatsManager.queryEvents(startOfDay, now)
    val event = UsageEvents.Event()

    val frontSince = HashMap<String, Long>()   // when each app last came to the front
    val totalMillis = HashMap<String, Long>()  // running total per app

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName ?: continue
      if (pkg !in wanted) continue

      when (event.eventType) {
        EVENT_APP_IN_FRONT -> {
          // Keep the first start if the app opens several screens in a row
          if (!frontSince.containsKey(pkg)) frontSince[pkg] = event.timeStamp
        }
        EVENT_APP_IN_BACK -> {
          val start = frontSince.remove(pkg)
          if (start != null) {
            totalMillis[pkg] = (totalMillis[pkg] ?: 0L) + (event.timeStamp - start)
          }
        }
      }
    }

    // Apps that are on screen right now: count up to this moment
    for ((pkg, start) in frontSince) {
      totalMillis[pkg] = (totalMillis[pkg] ?: 0L) + (now - start)
    }

    // Every wanted app gets a number (0 if it was not used today)
    return wanted.associateWith { pkg -> ((totalMillis[pkg] ?: 0L) / 60000L).toInt() }
  }
}
