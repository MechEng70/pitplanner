package io.github.mecheng70.pitplanner.alarms

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * JS bridge for step alarms (modules/pit-alarms/index.ts): the 0.2.0 Capacitor plugin on the Expo Modules
 * API, plus setQuiet. Everything that must work with the app dead is in AlarmScheduler, AlarmStore,
 * Notifications and the receivers; this class only passes calls through.
 */
class PitAlarmsModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name(MODULE_NAME)
        Events(EVENT_FIRED, EVENT_ACTION)

        OnCreate {
            instance = WeakReference(this@PitAlarmsModule)
            appContext.reactContext?.let(Notifications::ensureChannel)
        }
        OnDestroy { instance = null }

        /** Replace the whole alarm set: cancel everything, schedule this list. */
        AsyncFunction("setAlarms") { alarms: List<Map<String, Any?>> ->
            val r = AlarmScheduler.replaceAll(context, alarms.map { Alarm.fromJson(JSONObject(it)) })
            mapOf("scheduled" to r.scheduled, "exact" to r.exact)
        }

        AsyncFunction<Unit>("cancelAll") { AlarmScheduler.cancelAll(context) }

        /** The user tapped Done in the app: stop repeating these steps. */
        AsyncFunction("acknowledge") { keys: List<String> -> AlarmScheduler.acknowledge(context, keys) }

        /** Quiet alerts until this instant (epoch ms); null ends it. */
        AsyncFunction("setQuiet") { until: Double? -> AlarmScheduler.setQuiet(context, until?.toLong()) }

        /** A real alarm in `seconds`, through setAlarmClock, outside the cook's set. */
        AsyncFunction("testAlarm") { seconds: Int, title: String?, body: String? ->
            val at = System.currentTimeMillis() + seconds * 1000L
            val a = Alarm("test:$at", at, title ?: "Test alert", body ?: "Alarms work.", true, emptyList(), test = true)
            val r = AlarmScheduler.scheduleTest(context, a)
            mapOf("at" to at.toDouble(), "exact" to r.exact)
        }

        /** What is stored to fire (debug screen and device tests). */
        AsyncFunction<Map<String, Any?>>("getScheduled") {
            val s = AlarmStore(context)
            mapOf("alarms" to s.alarms.map { plain(it.toJson()) }, "nags" to s.nags.map { plain(it.toJson()) })
        }

        /** Done / +15 taps from notifications that the app has not applied yet. */
        AsyncFunction<List<Any?>>("drainActions") { AlarmStore(context).drainActions().map(::plain) }

        AsyncFunction<Map<String, Boolean>>("status") { status() }

        AsyncFunction("requestNotifications") { promise: Promise ->
            val permissions = appContext.permissions
            if (Build.VERSION.SDK_INT < 33 || permissions == null || NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                promise.resolve(status())
            } else {
                permissions.askForPermissions({ promise.resolve(status()) }, Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        /** Open the system screen for one of the alert settings: exactAlarm, battery, fullScreen, notifications. */
        AsyncFunction("openSettings") { which: String -> openSettings(which) }
    }

    private fun status(): Map<String, Boolean> {
        val pm = context.getSystemService(PowerManager::class.java)
        return mapOf(
            "notifications" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
            "exactAlarms" to AlarmScheduler.canExact(context),
            "batteryUnrestricted" to pm.isIgnoringBatteryOptimizations(context.packageName),
            "fullScreen" to Notifications.canFullScreen(context),
        )
    }

    @SuppressLint("BatteryLife") // sideloaded alarm app; SPEC section 6 asks for the exemption
    private fun openSettings(which: String) {
        val pkg = Uri.parse("package:${context.packageName}")
        val intent = when (which) {
            "exactAlarm" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg) else null
            "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)
            "fullScreen" -> if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) else null
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            else -> throw IllegalArgumentException("unknown settings screen: $which")
        } ?: return
        (appContext.currentActivity ?: context).startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    companion object {
        const val MODULE_NAME = "PitAlarms"
        const val EVENT_FIRED = "alarmFired"
        const val EVENT_ACTION = "alarmAction"

        private var instance: WeakReference<PitAlarmsModule>? = null

        /** Tell the app, if it is running, that an alarm fired or a notification action was tapped. */
        fun emit(event: String, alarmId: String, keys: List<String>, action: String? = null) {
            val module = instance?.get() ?: return
            val data = mutableMapOf<String, Any?>("alarmId" to alarmId, "keys" to keys)
            if (action != null) data["action"] = action
            runCatching { module.sendEvent(event, data) }
        }

        /** JSON as plain maps and lists for the bridge; instants as doubles (JS numbers). */
        private fun plain(v: Any?): Any? = when (v) {
            is JSONObject -> v.keys().asSequence().associateWith { plain(v.get(it)) }
            is JSONArray -> List(v.length()) { plain(v.get(it)) }
            is Long -> v.toDouble()
            JSONObject.NULL -> null
            else -> v
        }
    }
}
