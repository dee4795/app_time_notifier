package expo.modules.applistreader

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build

// ReminderNotifier — builds and shows our two kinds of notifications:
//  1. the small "Watching your app limits" one (required while the service runs)
//  2. the reminder with the user's message and photo
object ReminderNotifier {
  const val CHANNEL_WATCHING = "watching"
  const val CHANNEL_REMINDER = "limit_reached"
  const val WATCHING_ID = 4001

  // Android 8+ groups notifications into "channels" the user can control
  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)

    val watching = NotificationChannel(
      CHANNEL_WATCHING, "Background watching", NotificationManager.IMPORTANCE_LOW
    ).apply { description = "Small notice shown while we check your app limits" }

    val reminder = NotificationChannel(
      CHANNEL_REMINDER, "Limit reminders", NotificationManager.IMPORTANCE_HIGH
    ).apply { description = "Your own message when a daily limit is reached" }

    manager.createNotificationChannel(watching)
    manager.createNotificationChannel(reminder)
  }

  fun areEnabled(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return manager.areNotificationsEnabled()
  }

  @Suppress("DEPRECATION")
  private fun newBuilder(context: Context, channelId: String, high: Boolean): Notification.Builder {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, channelId)
    } else {
      Notification.Builder(context).setPriority(
        if (high) Notification.PRIORITY_HIGH else Notification.PRIORITY_LOW
      )
    }
  }

  // Tapping a notification opens our app
  private fun openAppIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    return PendingIntent.getActivity(
      context, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  // The small permanent notification of the background service
  fun buildWatchingNotification(context: Context): Notification {
    ensureChannels(context)
    val builder = newBuilder(context, CHANNEL_WATCHING, false)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle("Watching your app limits")
      .setContentText("Tap to open App Time Notifier")
      .setOngoing(true)
    openAppIntent(context)?.let { builder.setContentIntent(it) }
    return builder.build()
  }

  // Loads a photo from the phone and makes it smaller, so it uses little memory
  private fun loadBitmap(photoUri: String?, maxSize: Int): Bitmap? {
    if (photoUri.isNullOrBlank()) return null
    return try {
      val path = if (photoUri.startsWith("file:")) Uri.parse(photoUri).path else photoUri
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      var sample = 1
      while (bounds.outWidth / sample > maxSize || bounds.outHeight / sample > maxSize) {
        sample *= 2
      }
      BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample })
    } catch (e: Exception) {
      null
    }
  }

  // Shows the reminder. Returns false if notifications are switched off.
  fun showReminder(context: Context, item: WatchItem, isTest: Boolean): Boolean {
    if (!areEnabled(context)) return false
    ensureChannels(context)

    val title = if (isTest) "${item.appName}: test reminder" else "${item.appName}: time for a break"
    val builder = newBuilder(context, CHANNEL_REMINDER, true)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title)
      .setContentText(item.message)
      .setAutoCancel(true)
    openAppIntent(context)?.let { builder.setContentIntent(it) }

    val bigPhoto = loadBitmap(item.photoUri, 1024)
    if (bigPhoto != null) {
      // With a photo: a small picture when folded, the big photo + message when opened
      builder.setLargeIcon(loadBitmap(item.photoUri, 256) ?: bigPhoto)
      builder.setStyle(
        Notification.BigPictureStyle()
          .bigPicture(bigPhoto)
          .bigLargeIcon(null as Bitmap?)
          .setSummaryText(item.message)
      )
    } else {
      builder.setStyle(Notification.BigTextStyle().bigText(item.message))
    }

    val manager = context.getSystemService(NotificationManager::class.java)
    // Same app = same notification number, so a new reminder replaces the old one
    manager.notify(item.packageName.hashCode(), builder.build())
    return true
  }
}
