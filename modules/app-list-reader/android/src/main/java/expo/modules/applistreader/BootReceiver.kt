package expo.modules.applistreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// BootReceiver — when the phone restarts (or our app is updated), start the
// watcher again, so the user does not have to open the app first.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (NotifierStore.loadWatchList(context).isEmpty()) return
    if (!UsageReader.hasAccess(context)) return
    ServiceStarter.start(context)
  }
}
