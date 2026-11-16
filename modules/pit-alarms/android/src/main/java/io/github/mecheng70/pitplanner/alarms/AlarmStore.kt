package io.github.mecheng70.pitplanner.alarms

import android.content.Context
import android.os.UserManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

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
        private const val ACTIONS = "actions"

        /** One lock for the action queue across every AlarmStore in the process (each receiver makes its own). */
        private val QUEUE = Any()

        private fun newActionId(): String = UUID.randomUUID().toString()

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

    /*
     * Done / +15 taps from notifications, waiting for the app (T-079). Receivers add on the main thread; the
     * module reads and removes on its own thread. Every read-modify-write of the queue holds QUEUE, so a tap
     * queued while the app reads is never written over. The app reads without removing (peekActions), saves
     * the cook with the taps applied, then removes exactly the ids it read (ackActions): a tap queued since
     * stays, and a tap read but never saved (the app died) is read again. Each write inside the lock is a
     * commit(), on disk before the lock is let go.
     */

    /** Queue a tap; returns its id, unique and the same at every read. */
    fun queueAction(type: String, alarmId: String, keys: List<String>, at: Long): String = synchronized(QUEUE) {
        val id = newActionId()
        write(ACTIONS, actions() + JSONObject()
            .put("id", id).put("type", type).put("alarmId", alarmId).put("keys", JSONArray(keys)).put("at", at))
        id
    }

    /** The queued taps, oldest first. Nothing is removed. */
    fun peekActions(): List<JSONObject> = synchronized(QUEUE) { actions() }

    /** Remove the taps with these ids, and only those. Returns how many were removed. */
    fun ackActions(ids: Collection<String>): Int = synchronized(QUEUE) {
        val drop = ids.toSet()
        val all = actions()
        val keep = all.filterNot { it.optString("id") in drop }
        if (keep.size != all.size) write(ACTIONS, keep)
        all.size - keep.size
    }

    /** The queue as stored. A tap queued by a build before ids gets one here, saved, so it reads the same twice. Hold QUEUE. */
    private fun actions(): List<JSONObject> {
        val list = read(ACTIONS)
        val unnamed = list.filter { it.optString("id").isEmpty() }
        if (unnamed.isEmpty()) return list
        unnamed.forEach { it.put("id", newActionId()) }
        write(ACTIONS, list)
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
