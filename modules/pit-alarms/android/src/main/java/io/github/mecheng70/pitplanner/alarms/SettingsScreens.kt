package io.github.mecheng70.pitplanner.alarms

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/** The system screens the alert checks send the user to (PitAlarmsModule.openSettings). */
object SettingsScreens {
    /** The intent for one of exactAlarm, battery, fullScreen, notifications; null when this Android has no such screen. */
    fun intent(which: String, packageName: String, sdk: Int = Build.VERSION.SDK_INT): Intent? {
        val pkg = Uri.parse("package:$packageName")
        return when (which) {
            "exactAlarm" -> if (sdk >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) else null
            // Pit Planner's own App info, where the user opens App battery usage and picks Unrestricted. The
            // one-tap question (ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) needs a permission Google Play
            // allows for a few app types only (T-102).
            "battery" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
            "fullScreen" -> if (sdk >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) else null
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            else -> throw IllegalArgumentException("unknown settings screen: $which")
        }
    }
}
