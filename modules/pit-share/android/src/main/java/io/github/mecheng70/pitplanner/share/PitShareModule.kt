package io.github.mecheng70.pitplanner.share

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for opened .pitplan files (modules/pit-share/index.ts). The intent filters are added to the
 * main activity by plugins/withPitplanIntents.ts; this module sees the launch intent and every new intent,
 * keeps the file's URI until JS asks, and reads it then (OpenedPlan).
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
