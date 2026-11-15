package io.github.mecheng70.pitplanner.share

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for opened .pitplan files (modules/pit-share/index.ts). The intent filters are added to the
 * main activity by plugins/withPitplanIntents.ts; this module sees the launch intent and every new intent,
 * keeps the file's URI until JS asks, and reads it then (OpenedPlan). The other way, `sendFile` opens the
 * share sheet for one of the app's own files with a recipient (SendFile).
 */
class PitShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)
    Events(EVENT_OPENED)

    // The app was already running (singleTask): Android hands the file to the open activity.
    OnNewIntent { intent ->
      if (offer(intent)) sendEvent(EVENT_OPENED)
    }

    /**
     * The opened file, once: `{ text, name? }`, `{ error }`, or null when no file is waiting. Also looks at
     * the intent the activity was started with, which is how a file opens the app from cold.
     */
    AsyncFunction("takeOpenedPlan") {
      offer(appContext.currentActivity?.intent)
      val uri = take() ?: return@AsyncFunction null
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      OpenedPlan.read(context, uri)
    }

    /**
     * The share sheet for one file the app wrote (a file:// URL in its cache or files folder), with a
     * recipient and a subject for the email app the tester picks (SendFile; T-065). Resolves once the sheet
     * is open. Nothing is sent here. Throws for any other file, so JS can fall back to expo-sharing.
     */
    AsyncFunction("sendFile") { url: String, mimeType: String, recipient: String, subject: String, title: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val file = SendFile.ownFile(url, listOf(context.cacheDir, context.filesDir))
        ?: throw IllegalArgumentException("not a file in the app's cache or files folder")
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val uri = FileProvider.getUriForFile(context, SendFile.authority(context.packageName), file)
      activity.startActivity(SendFile.chooser(SendFile.intent(uri, mimeType, recipient, subject), title))
    }
  }

  companion object {
    const val MODULE_NAME = "PitShare"
    const val EVENT_OPENED = "planOpened"

    // One file at a time: a second hand-off before JS took the first replaces it.
    @Volatile
    private var pending: Uri? = null

    /** Keep the intent's file for JS. False for an intent that is not a new file hand-off. */
    @Synchronized
    fun offer(intent: Intent?): Boolean {
      val uri = OpenedPlan.uriOf(intent) ?: return false
      OpenedPlan.markHandled(intent!!)
      pending = uri
      return true
    }

    @Synchronized
    fun take(): Uri? {
      val uri = pending
      pending = null
      return uri
    }
  }
}
