package expo.modules.applistreader

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.util.Calendar

// Android's usage events use simple numbers for "app came to the front" (1)
// and "app went to the background" (2). We use the numbers directly so the
// code works on old and new Android versions without deprecation warnings.
private const val EVENT_APP_IN_FRONT = 1
private const val EVENT_APP_IN_BACK = 2

// AppListReaderModule — talks to Android for us:
//  1. getInstalledApps       -> apps that have a home screen icon
//  2. hasUsageAccess         -> is the special "Usage access" permission on?
//  3. openUsageAccessSettings-> opens the Settings page where the user turns it on
//  4. getTodayUsageMinutes   -> minutes each app was on screen today
class AppListReaderModule : Module() {

  override fun definition() = ModuleDefinition {
    // "AppListReader" is the name JavaScript uses to find this module
    Name("AppListReader")

    AsyncFunction("getInstalledApps") {
      getInstalledApps()
    }

    Function("hasUsageAccess") {
      hasUsageAccess()
    }

    // For testing: tells us exactly what Android answered (shown in the terminal log)
    Function("getUsageAccessDebug") {
      usageAccessDebug()
    }

    Function("openUsageAccessSettings") {
      openUsageAccessSettings()
    }

    AsyncFunction("getTodayUsageMinutes") { packageNames: List<String> ->
      getTodayUsageMinutes(packageNames)
    }
  }

  // ── 1. Installed apps (unchanged from M2) ──
  private fun getInstalledApps(): List<Map<String, Any?>> {
    val pm = appContext.reactContext?.packageManager ?: return emptyList()

    val intent = Intent(Intent.ACTION_MAIN, null).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

    val resolveInfoList = pm.queryIntentActivities(intent, PackageManager.GET_META_DATA)
    val sortedList = resolveInfoList.sortedBy { it.loadLabel(pm).toString().lowercase() }

    return sortedList.map { resolveInfo ->
      val appName = resolveInfo.loadLabel(pm).toString()
      val packageName = resolveInfo.activityInfo.packageName

      val iconBase64 = try {
        drawableToBase64(resolveInfo.loadIcon(pm))
      } catch (e: Exception) {
        null
      }

      mapOf(
        "appName" to appName,
        "packageName" to packageName,
        "icon" to iconBase64
      )
    }
  }

  // ── 2. Is "Usage access" turned on for our app? ──
  // This permission cannot be asked with a normal pop-up. The user must turn
  // it on in Settings. AppOpsManager is Android's "who may do what" checker.
  // Android answers with a number: 0 = allowed, 1 = ignored, 2 = errored,
  // 3 = default ("look at the normal permission instead").
  private fun readUsageMode(context: Context): Int {
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

  private fun hasUsageAccess(): Boolean {
    val context = appContext.reactContext ?: return false
    val mode = readUsageMode(context)
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      // Some phones answer "default". Then the normal permission decides.
      context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  private fun usageAccessDebug(): String {
    val context = appContext.reactContext ?: return "no context"
    val mode = readUsageMode(context)
    val permission = context.checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS) ==
      PackageManager.PERMISSION_GRANTED
    return "mode=$mode (0=allowed,1=ignored,2=errored,3=default), permissionGranted=$permission"
  }

  // ── 3. Open the Settings page for Usage access ──
  private fun openUsageAccessSettings() {
    val context = appContext.reactContext ?: return

    // NEW_TASK is needed because we start the screen from an app context.
    // CLEAR_TASK removes any old Settings window that is still waiting in
    // the recent apps list. Without it, Android can show that OLD window,
    // which may still show the switch as ON when it is really OFF.
    val flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(flags)
      // On newer Android versions this jumps straight to OUR app's switch.
      data = Uri.parse("package:${context.packageName}")
    }
    try {
      context.startActivity(intent)
    } catch (e: Exception) {
      // Some phones do not support the direct link, so open the general list.
      context.startActivity(
        Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(flags)
      )
    }
  }

  // ── 4. Minutes each app was on screen since midnight (phone's local time) ──
  // How it works: Android keeps a log of events ("Instagram came to front at
  // 10:00", "Instagram went to back at 10:05"). We add up the time between
  // each "front" and the next "back". One pass over the log handles all apps.
  private fun getTodayUsageMinutes(packageNames: List<String>): Map<String, Int> {
    val context = appContext.reactContext ?: return emptyMap()
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

  // Helper: converts an Android Drawable (icon) to a Base64-encoded PNG string
  private fun drawableToBase64(drawable: Drawable): String {
    val bitmap = Bitmap.createBitmap(
      drawable.intrinsicWidth.coerceAtLeast(1),
      drawable.intrinsicHeight.coerceAtLeast(1),
      Bitmap.Config.ARGB_8888
    )
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, canvas.width, canvas.height)
    drawable.draw(canvas)

    val outputStream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
    return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
  }
}
