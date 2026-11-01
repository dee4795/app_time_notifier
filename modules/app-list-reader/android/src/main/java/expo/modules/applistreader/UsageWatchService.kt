package expo.modules.applistreader

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.Log

private const val TAG = "AppTimeNotifier"
private const val CHECK_EVERY_MS = 30_000L

// Starts and stops the service. Used by the screen and by the boot receiver.
object ServiceStarter {
  fun start(context: Context) {
    try {
      val intent = Intent(context, UsageWatchService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    } catch (e: Exception) {
      Log.w(TAG, "Could not start watching: ${e.message}")
    }
  }

  fun stop(context: Context) {
    context.stopService(Intent(context, UsageWatchService::class.java))
  }
}

// UsageWatchService — the "watcher". Android only lets an app run in the
// background if it shows a small permanent notification (a foreground service).
// Every 30 seconds the watcher:
//  1. reads the list of watched apps,
//  2. asks Android how long each was used today,
//  3. sends the reminder if the limit is reached (once per app per day).
class UsageWatchService : Service() {
  private var thread: HandlerThread? = null
  private var handler: Handler? = null

  private val checkTask = object : Runnable {
    override fun run() {
      try {
        checkNow()
      } catch (e: Exception) {
        Log.w(TAG, "Check failed: ${e.message}")
      }
      handler?.postDelayed(this, CHECK_EVERY_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    ReminderNotifier.ensureChannels(this)
    // Work runs on its own thread, so the screen is never slowed down
    thread = HandlerThread("usage-watch").also { it.start() }
    handler = Handler(thread!!.looper)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Android wants this within 5 seconds of starting the service
    val notification = ReminderNotifier.buildWatchingNotification(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        ReminderNotifier.WATCHING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      )
    } else {
      startForeground(ReminderNotifier.WATCHING_ID, notification)
    }

    handler?.removeCallbacks(checkTask)
    handler?.post(checkTask)   // first check right away
    return START_STICKY        // ask Android to restart us if it stops us
  }

  private fun checkNow() {
    val items = NotifierStore.loadWatchList(this)
    if (items.isEmpty()) {
      stopSelf()   // nothing to watch, so no need to run
      return
    }
    if (!UsageReader.hasAccess(this)) return

    val usage = UsageReader.todayMinutes(this, items.map { it.packageName })
    val today = NotifierStore.todayKey()

    for (item in items) {
      val used = usage[item.packageName] ?: 0
      val alreadySentToday = NotifierStore.lastNotifiedDay(this, item.packageName) == today
      if (used >= item.limitMinutes && !alreadySentToday) {
        // Only remember "sent" if the notification was really shown
        if (ReminderNotifier.showReminder(this, item, isTest = false)) {
          NotifierStore.markNotified(this, item.packageName, today)
        }
      }
    }
  }

  override fun onDestroy() {
    handler?.removeCallbacksAndMessages(null)
    thread?.quitSafely()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
