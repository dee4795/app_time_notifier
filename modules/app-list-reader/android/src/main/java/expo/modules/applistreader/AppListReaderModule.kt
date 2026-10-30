package expo.modules.applistreader

import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

// AppListReaderModule — reads the list of apps installed on the Android device
// that appear on the home screen (launchable apps).
// We use PackageManager, which is the Android system's app directory.
class AppListReaderModule : Module() {

  override fun definition() = ModuleDefinition {
    // "AppListReader" is the name JavaScript uses to find this module
    Name("AppListReader")

    // Define the async function JS can call
    AsyncFunction("getInstalledApps") {
      getInstalledApps()
    }
  }

  // Queries Android for all apps that have a LAUNCHER icon (home screen apps)
  private fun getInstalledApps(): List<Map<String, Any?>> {
    val pm = appContext.reactContext?.packageManager ?: return emptyList()

    // Build an intent that matches apps with a home screen icon
    val intent = Intent(Intent.ACTION_MAIN, null).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

    // Get the list of matching apps
    val resolveInfoList = pm.queryIntentActivities(intent, PackageManager.GET_META_DATA)

    // Sort alphabetically so the list looks nice
    val sortedList = resolveInfoList.sortedBy { it.loadLabel(pm).toString().lowercase() }

    return sortedList.map { resolveInfo ->
      val appName = resolveInfo.loadLabel(pm).toString()
      val packageName = resolveInfo.activityInfo.packageName

      // Convert the app icon to a Base64 string so we can send it to JavaScript
      // Base64 = a way to turn binary image data into text so it can travel as a string
      val iconBase64 = try {
        val drawable = resolveInfo.loadIcon(pm)
        drawableToBase64(drawable)
      } catch (e: Exception) {
        null
      }

      // Return a map — JavaScript will receive this as a plain object
      mapOf(
        "appName" to appName,
        "packageName" to packageName,
        "icon" to iconBase64
      )
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
    // PNG with 100% quality — no data loss
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
    return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
  }
}

