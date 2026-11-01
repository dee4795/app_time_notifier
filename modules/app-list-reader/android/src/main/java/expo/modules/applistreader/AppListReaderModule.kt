package expo.modules.applistreader

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.drawable.Drawable
import android.media.ExifInterface
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

// AppListReaderModule — the doorway between the screen (JavaScript) and Android.
//  Apps:         getInstalledApps
//  Usage access: hasUsageAccess, openUsageAccessSettings, getUsageAccessDebug
//  Usage time:   getTodayUsageMinutes
//  Photos:       savePhoto, deletePhoto
//  Reminders:    saveWatchList, startWatching, stopWatching,
//                areNotificationsEnabled, showTestNotification
class AppListReaderModule : Module() {

  private val ctx: Context?
    get() = appContext.reactContext

  override fun definition() = ModuleDefinition {
    // "AppListReader" is the name JavaScript uses to find this module
    Name("AppListReader")

    AsyncFunction("getInstalledApps") {
      getInstalledApps()
    }

    Function("hasUsageAccess") {
      val c = ctx
      c != null && UsageReader.hasAccess(c)
    }

    // For testing: tells us exactly what Android answered (shown in the terminal log)
    Function("getUsageAccessDebug") {
      val c = ctx
      if (c == null) "no context" else UsageReader.debugText(c)
    }

    Function("openUsageAccessSettings") {
      openUsageAccessSettings()
    }

    AsyncFunction("getTodayUsageMinutes") { packageNames: List<String> ->
      val c = ctx
      if (c == null) emptyMap() else UsageReader.todayMinutes(c, packageNames)
    }

    // Copies the picked photo into the app's private folder (smaller, upright)
    AsyncFunction("savePhoto") { sourceUri: String ->
      savePhoto(sourceUri)
    }

    Function("deletePhoto") { photoUri: String ->
      deletePhoto(photoUri)
      Unit
    }

    // The screen gives us the list of watched apps (as JSON text)
    Function("saveWatchList") { json: String ->
      ctx?.let { NotifierStore.saveWatchList(it, json) }
      Log.i("AppTimeNotifier", "Saved watch list (${json.length} characters)")
      Unit
    }

    Function("startWatching") {
      ctx?.let { ServiceStarter.start(it) }
      Unit
    }

    Function("stopWatching") {
      ctx?.let { ServiceStarter.stop(it) }
      Unit
    }

    Function("areNotificationsEnabled") {
      val c = ctx
      c != null && ReminderNotifier.areEnabled(c)
    }

    // Shows the reminder right now, so the user can see how it will look.
    // Returns "ok", or a short sentence that says what went wrong.
    Function("showTestNotification") { packageName: String ->
      val c = ctx
      if (c == null) {
        "No Android context yet. Please reopen the app."
      } else {
        try {
          val list = NotifierStore.loadWatchList(c)
          val item = list.firstOrNull { it.packageName == packageName }
          when {
            item == null ->
              "This app is not in the saved list yet (saved apps: ${list.size}). Close and reopen App Time Notifier, then try again."
            !ReminderNotifier.areEnabled(c) ->
              "Android says notifications are OFF for this app."
            ReminderNotifier.showReminder(c, item, isTest = true) -> "ok"
            else -> "The notification could not be shown."
          }
        } catch (e: Exception) {
          "Error: ${e.message}"
        }
      }
    }
  }

  // ── Installed apps (unchanged from M2) ──
  private fun getInstalledApps(): List<Map<String, Any?>> {
    val pm = ctx?.packageManager ?: return emptyList()

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

  // ── Save a photo for the reminder ──
  // The picker gives us a temporary picture. We make our own copy in the app's
  // private folder, so it stays as long as the app is installed. While copying
  // we also make it smaller (big photos waste memory) and turn it upright.
  private fun savePhoto(sourceUri: String): String {
    val c = ctx ?: throw IllegalStateException("No Android context")
    val resolver = c.contentResolver
    val uri = Uri.parse(sourceUri)

    // Step 1: read only the picture size (cheap)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }

    // Step 2: decode a smaller copy, at most about 1600 pixels wide or tall
    var sample = 1
    while (bounds.outWidth / sample > 1600 || bounds.outHeight / sample > 1600) sample *= 2
    val decoded = resolver.openInputStream(uri)?.use {
      BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: throw IllegalStateException("Could not read the photo")

    // Step 3: some photos are saved sideways with a "please rotate" note inside
    val orientation = try {
      resolver.openInputStream(uri)?.use {
        ExifInterface(it).getAttributeInt(
          ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL
        )
      } ?: ExifInterface.ORIENTATION_NORMAL
    } catch (e: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val degrees = when (orientation) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    val bitmap = if (degrees != 0f) {
      Bitmap.createBitmap(
        decoded, 0, 0, decoded.width, decoded.height,
        Matrix().apply { postRotate(degrees) }, true
      )
    } else {
      decoded
    }

    // Step 4: save as a JPEG in the app's own private folder
    val folder = File(c.filesDir, "photos")
    folder.mkdirs()
    val file = File(folder, "photo_${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 85, it) }
    Log.i("AppTimeNotifier", "Saved photo ${file.name}: ${file.length()} bytes, ${bitmap.width}x${bitmap.height}")

    return "file://" + file.absolutePath
  }

  // Deletes a photo we saved. Only files inside our own "photos" folder are touched.
  private fun deletePhoto(photoUri: String) {
    val c = ctx ?: return
    val path = Uri.parse(photoUri).path ?: return
    val file = File(path)
    val folder = File(c.filesDir, "photos")
    if (file.parentFile?.canonicalPath == folder.canonicalPath) file.delete()
  }

  // ── Open the Settings page for Usage access ──
  private fun openUsageAccessSettings() {
    val c = ctx ?: return

    // NEW_TASK is needed because we start the screen from an app context.
    // CLEAR_TASK removes any old Settings window that is still waiting in
    // the recent apps list.
    val flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(flags)
      // On newer Android versions this jumps straight to OUR app's switch.
      data = Uri.parse("package:${c.packageName}")
    }
    try {
      c.startActivity(intent)
    } catch (e: Exception) {
      // Some phones do not support the direct link, so open the general list.
      c.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(flags))
    }
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
