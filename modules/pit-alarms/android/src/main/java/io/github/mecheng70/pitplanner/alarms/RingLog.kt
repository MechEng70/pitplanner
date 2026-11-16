package io.github.mecheng70.pitplanner.alarms

import android.content.Context
import android.os.PowerManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * One ring of a step alert, as the phone saw it (T-068). Step keys and times only: never a title or text.
 *
 * - plannedAt: when this ring was due. The step's time for the first ring; for a repeat, the time that repeat
 *   was set for (after Quiet or a reboot, the time it was moved to).
 * - actualAt: the wall clock when the receiver ran. elapsedRealtime: ms since boot at the same moment; it
 *   does not move when the time is changed, so a clock change can be told from a late ring.
 * - repeat: 0 for the first ring, 1 to 6 for "Still waiting", 7 for the last "Cook needs you" (last = true).
 * - source: `alarm` (the alarm's own time came), `restore` (rung by the restore path after a boot or an
 *   update, as missed), `snooze` (a +15 min ring and its repeats).
 * - idle, interactive: PowerManager.isDeviceIdleMode and isInteractive just before the notification was
 *   posted; null when they could not be read.
 * - posted: the notification was handed to the system without an error.
 */
data class Ring(
    val alarmId: String,
    val keys: List<String>,
    val plannedAt: Long,
    val actualAt: Long,
    val elapsedRealtime: Long,
    val repeat: Int,
    val last: Boolean,
    val source: String,
    val test: Boolean,
    val idle: Boolean?,
    val interactive: Boolean?,
    val posted: Boolean,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("alarmId", alarmId).put("keys", JSONArray(keys))
        .put("plannedAt", plannedAt).put("actualAt", actualAt).put("elapsedRealtime", elapsedRealtime)
        .put("repeat", repeat).put("last", last).put("source", source).put("test", test)
        .put("idle", idle ?: JSONObject.NULL).put("interactive", interactive ?: JSONObject.NULL)
        .put("posted", posted)

    companion object {
        const val ALARM = "alarm"
        const val RESTORE = "restore"
        const val SNOOZE = "snooze"

        fun fromJson(o: JSONObject) = Ring(
            alarmId = o.getString("alarmId"),
            keys = o.optJSONArray("keys").strings(),
            plannedAt = o.getLong("plannedAt"),
            actualAt = o.getLong("actualAt"),
            elapsedRealtime = o.optLong("elapsedRealtime"),
            repeat = o.optInt("repeat"),
            last = o.optBoolean("last"),
            source = o.optString("source", ALARM),
            test = o.optBoolean("test"),
            idle = if (o.isNull("idle")) null else o.optBoolean("idle"),
            interactive = if (o.isNull("interactive")) null else o.optBoolean("interactive"),
            posted = o.optBoolean("posted", true),
        )

        /** How a ring came about: the restore path, a +15 min ring (its id ends in ~snooze), or the alarm's own time. */
        fun sourceOf(alarmId: String, restored: Boolean): String = when {
            restored -> RESTORE
            alarmId.endsWith(AlarmScheduler.SNOOZE_SUFFIX) -> SNOOZE
            else -> ALARM
        }
    }
}

/** The clocks and the phone's state when a ring starts, read before its notification is posted. */
class RingMoment(val at: Long, val elapsed: Long, val idle: Boolean?, val interactive: Boolean?)

/**
 * The ring log (T-068): every ring, kept with the app dead, so the debug file can show for each step when it
 * was due and when it rang. Device-protected prefs like AlarmStore (a ring before the first unlock after a
 * reboot is kept), in a file of its own: replacing the alarm set, ending the cook and restoring leave it; only
 * the cap (newest CAP rings) and `clear` remove rings. Not in the Android backup (the rules only include).
 */
class RingLog(context: Context) {
    private val prefs = context.applicationContext.createDeviceProtectedStorageContext()
        .getSharedPreferences(NAME, Context.MODE_PRIVATE)

    companion object {
        const val NAME = "pit_alarm_rings"
        /** A full cook with every step repeated to the end is under 200 rings; this holds several. */
        const val CAP = 500
        private const val KEY = "rings"
        private const val TAG = "PitAlarms"

        /** One lock for every RingLog in the process: receivers append on the main thread, the module reads on its own. */
        private val LOCK = Any()

        /** How receivers open the log. Tests swap in one that fails; nothing else does. */
        @Volatile
        var open: (Context) -> RingLog = ::RingLog

        /** Read at the start of a ring, before the notification is posted (it can turn the screen on). Never throws. */
        fun moment(ctx: Context, now: Long): RingMoment {
            val pm = runCatching { ctx.getSystemService(PowerManager::class.java) }.getOrNull()
            return RingMoment(
                at = now,
                elapsed = runCatching { Clock.elapsed() }.getOrDefault(-1L),
                idle = runCatching { pm?.isDeviceIdleMode }.getOrNull(),
                interactive = runCatching { pm?.isInteractive }.getOrNull(),
            )
        }

        /**
         * Log a ring that has happened. Called after the notification is posted and the next repeat is set, so
         * a slow or failing log delays neither. Never throws into the receiver.
         */
        fun record(
            ctx: Context,
            m: RingMoment,
            alarmId: String,
            keys: List<String>,
            plannedAt: Long,
            repeat: Int,
            last: Boolean,
            source: String,
            test: Boolean,
            posted: Boolean,
        ) {
            try {
                open(ctx).append(Ring(alarmId, keys, plannedAt, m.at, m.elapsed, repeat, last, source, test, m.idle, m.interactive, posted))
            } catch (t: Throwable) {
                runCatching { Log.w(TAG, "ring not logged", t) }
            }
        }
    }

    /** Add one ring; the oldest go once there are more than CAP. On disk (commit) before it returns. */
    fun append(ring: Ring) {
        synchronized(LOCK) { write((read() + ring.toJson()).takeLast(CAP)) }
    }

    /** Every ring kept, oldest first. A record that cannot be read is skipped. */
    fun all(): List<Ring> = synchronized(LOCK) { read().mapNotNull { runCatching { Ring.fromJson(it) }.getOrNull() } }

    fun clear() {
        synchronized(LOCK) { prefs.edit().remove(KEY).commit() }
    }

    private fun read(): List<JSONObject> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        return runCatching { JSONArray(raw).let { a -> List(a.length()) { a.getJSONObject(it) } } }.getOrDefault(emptyList())
    }

    // commit(), not apply(): a receiver can be killed right after onReceive returns.
    private fun write(list: List<JSONObject>) {
        prefs.edit().putString(KEY, JSONArray(list).toString()).commit()
    }
}
