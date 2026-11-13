package io.github.mecheng70.pitplanner.alarms

import android.content.Context
import android.os.UserManager
import org.json.JSONArray
import org.json.JSONObject

/** One scheduled alert. keys are the engine's step keys (stable across replans). */
data class Alarm(
    val id: String,
    val at: Long,
    val title: String,
    val body: String,
    val critical: Boolean,
    val keys: List<String>,
    val test: Boolean = false,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id).put("at", at).put("title", title).put("body", body)
        .put("critical", critical).put("keys", JSONArray(keys)).put("test", test)

    companion object {
        fun fromJson(o: JSONObject) = Alarm(
            id = o.getString("id"),
            at = o.getLong("at"),
            title = o.optString("title"),
            body = o.optString("body"),
            critical = o.optBoolean("critical"),
            keys = o.optJSONArray("keys").strings(),
            test = o.optBoolean("test"),
        )
    }
}

/** A fired step nobody has tapped Done on yet. Repeats every 10 min (SPEC section 6). */
data class Nag(
    val alarmId: String,
    val keys: List<String>,
    val title: String,
    val body: String,
    val count: Int,
    val nextAt: Long,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("alarmId", alarmId).put("keys", JSONArray(keys)).put("title", title).put("body", body)
        .put("count", count).put("nextAt", nextAt)

    companion object {
        fun fromJson(o: JSONObject) = Nag(
            alarmId = o.getString("alarmId"),
            keys = o.optJSONArray("keys").strings(),
            title = o.optString("title"),
            body = o.optString("body"),
            count = o.optInt("count"),
            nextAt = o.getLong("nextAt"),
        )
    }
}

fun JSONArray?.strings(): List<String> = if (this == null) emptyList() else List(length()) { getString(it) }

/**
 * Everything the native side needs with the app dead: the alarm set, open nags and the
 * actions taken from notifications that the app has not processed yet.
 */
class AlarmStore(context: Context) {
    private val prefs = storage(context).getSharedPreferences(NAME, Context.MODE_PRIVATE)

    companion object {
        private const val NAME = "pit_alarms"

        /**
         * Device-protected storage: readable right after a reboot, before the phone is first unlocked
         * (LOCKED_BOOT_COMPLETED), so an overnight restart cannot silence a cook. It only holds step
         * titles and times. Data written by earlier builds to normal storage is moved over once.
         */
        private fun storage(context: Context): Context {
            val app = context.applicationContext
            val dp = app.createDeviceProtectedStorageContext()
            val meta = dp.getSharedPreferences("pit_alarms_meta", Context.MODE_PRIVATE)
            // Normal storage can only be read once the user has unlocked since boot; until then, wait.
            val unlocked = app.getSystemService(UserManager::class.java).isUserUnlocked
            if (unlocked && !meta.getBoolean("migrated", false)) {
                if (dp.moveSharedPreferencesFrom(app, NAME)) meta.edit().putBoolean("migrated", true).commit()
            }
            return dp
        }
    }

    var alarms: List<Alarm>
        get() = read("alarms").map(Alarm::fromJson)
        set(v) = write("alarms", v.map { it.toJson() })

    var nags: List<Nag>
        get() = read("nags").map(Nag::fromJson)
        set(v) = write("nags", v.map { it.toJson() })

    /** Quiet alerts: no repeat rings before this instant (0 when Quiet is off). */
    var quietUntil: Long
        get() = prefs.getLong("quietUntil", 0L)
        set(v) { prefs.edit().putLong("quietUntil", v).commit() }

    fun queueAction(type: String, alarmId: String, keys: List<String>, at: Long) {
        val list = read("actions") + JSONObject()
            .put("type", type).put("alarmId", alarmId).put("keys", JSONArray(keys)).put("at", at)
        write("actions", list)
    }

    fun drainActions(): List<JSONObject> {
        val list = read("actions")
        write("actions", emptyList())
        return list
    }

    private fun read(key: String): List<JSONObject> {
        val raw = prefs.getString(key, null) ?: return emptyList()
        return runCatching { JSONArray(raw).let { a -> List(a.length()) { a.getJSONObject(it) } } }.getOrDefault(emptyList())
    }

    // commit(), not apply(): a receiver can be killed right after onReceive returns.
    private fun write(key: String, list: List<JSONObject>) {
        prefs.edit().putString(key, JSONArray(list).toString()).commit()
    }
}
