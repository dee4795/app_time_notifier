package expo.modules.applistreader

import android.content.Context
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// One monitored app, exactly what the user chose on the screen.
data class WatchItem(
  val appName: String,
  val packageName: String,
  val limitMinutes: Int,
  val message: String,
  val photoUri: String?
)

// NotifierStore — a small notebook saved on the phone (SharedPreferences).
// The screen (JavaScript) writes the list of watched apps here. The background
// service reads it, even when the screen part of the app is closed.
object NotifierStore {
  private const val PREFS = "app_time_notifier_store"
  private const val KEY_LIST = "watchlist"

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun saveWatchList(context: Context, json: String) {
    prefs(context).edit().putString(KEY_LIST, json).apply()
  }

  fun loadWatchList(context: Context): List<WatchItem> {
    val json = prefs(context).getString(KEY_LIST, null) ?: return emptyList()
    return try {
      val array = JSONArray(json)
      (0 until array.length()).map { i ->
        val o = array.getJSONObject(i)
        WatchItem(
          appName = o.optString("appName", ""),
          packageName = o.getString("packageName"),
          limitMinutes = o.getInt("limitMinutes"),
          message = o.optString("message", ""),
          photoUri = if (o.isNull("photoUri")) null
                     else o.optString("photoUri", "").takeIf { it.isNotBlank() }
        )
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  // "2026-11-01" — used to send only ONE reminder per app per day
  fun todayKey(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

  fun lastNotifiedDay(context: Context, packageName: String): String? =
    prefs(context).getString("notified_$packageName", null)

  fun markNotified(context: Context, packageName: String, day: String) {
    prefs(context).edit().putString("notified_$packageName", day).apply()
  }
}
