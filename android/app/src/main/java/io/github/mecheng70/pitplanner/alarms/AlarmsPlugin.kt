package io.github.mecheng70.pitplanner.alarms

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.lang.ref.WeakReference

/** JS bridge for step alarms (src/platform/alarms.ts). */
@CapacitorPlugin(
    name = "PitAlarms",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class AlarmsPlugin : Plugin() {

    override fun load() {
        instance = WeakReference(this)
        Notifications.ensureChannel(context)
    }

    /** Replace the whole alarm set: cancel everything, schedule this list. */
    @PluginMethod
    fun setAlarms(call: PluginCall) {
        val arr = call.getArray("alarms") ?: return call.reject("alarms is required")
        val list = (0 until arr.length()).map { Alarm.fromJson(arr.getJSONObject(it)) }
        val r = AlarmScheduler.replaceAll(context, list)
        call.resolve(JSObject().put("scheduled", r.scheduled).put("exact", r.exact))
    }

    @PluginMethod
    fun cancelAll(call: PluginCall) {
        AlarmScheduler.cancelAll(context)
        call.resolve()
    }

    /** The user tapped Done in the app: stop repeating these steps. */
    @PluginMethod
    fun acknowledge(call: PluginCall) {
        AlarmScheduler.acknowledge(context, call.getArray("keys")?.toList<String>() ?: emptyList())
        call.resolve()
    }

    /** A real alarm in `seconds`, through setAlarmClock, outside the cook's set. */
    @PluginMethod
    fun testAlarm(call: PluginCall) {
        val at = System.currentTimeMillis() + (call.getInt("seconds") ?: 10) * 1000L
        val a = Alarm("test:$at", at, call.getString("title") ?: "Test alert", call.getString("body") ?: "Alarms work.", true, emptyList(), test = true)
        val r = AlarmScheduler.scheduleTest(context, a)
        call.resolve(JSObject().put("at", at).put("exact", r.exact))
    }

    /** What is stored to fire (debug screen and device tests). */
    @PluginMethod
    fun getScheduled(call: PluginCall) {
        val s = AlarmStore(context)
        call.resolve(JSObject()
            .put("alarms", JSArray(s.alarms.map { it.toJson() }))
            .put("nags", JSArray(s.nags.map { it.toJson() })))
    }

    /** Done / +15 / open taps from notifications that the app has not applied yet. */
    @PluginMethod
    fun drainActions(call: PluginCall) {
        call.resolve(JSObject().put("actions", AlarmStore(context).drainActions()))
    }

    @PluginMethod
    fun status(call: PluginCall) = call.resolve(statusObject())

    @PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) return call.resolve(statusObject())
        requestPermissionForAlias("notifications", call, "notificationsResult")
    }

    @PermissionCallback
    private fun notificationsResult(call: PluginCall) = call.resolve(statusObject())

    @PluginMethod
    fun openExactAlarmSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg()))
        call.resolve()
    }

    @SuppressLint("BatteryLife") // sideloaded alarm app; SPEC section 6 asks for the exemption
    @PluginMethod
    fun requestBatteryExemption(call: PluginCall) {
        open(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg()))
        call.resolve()
    }

    @PluginMethod
    fun openFullScreenSettings(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= 34) open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg()))
        call.resolve()
    }

    @PluginMethod
    fun openNotificationSettings(call: PluginCall) {
        open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
        call.resolve()
    }

    private fun statusObject(): JSObject {
        val pm = context.getSystemService(PowerManager::class.java)
        return JSObject()
            .put("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
            .put("exactAlarms", AlarmScheduler.canExact(context))
            .put("batteryUnrestricted", pm.isIgnoringBatteryOptimizations(context.packageName))
            .put("fullScreen", Notifications.canFullScreen(context))
    }

    private fun pkg() = Uri.parse("package:${context.packageName}")
    private fun open(i: Intent) = activity.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

    companion object {
        private var instance: WeakReference<AlarmsPlugin>? = null

        /** Tell the app, if it is running, that an alarm fired or a notification action was tapped. */
        fun emit(event: String, alarmId: String, keys: List<String>, action: String? = null) {
            val p = instance?.get() ?: return
            val data = JSObject().put("alarmId", alarmId).put("keys", JSArray(keys))
            if (action != null) data.put("action", action)
            p.notifyListeners(event, data, true)
        }
    }
}
