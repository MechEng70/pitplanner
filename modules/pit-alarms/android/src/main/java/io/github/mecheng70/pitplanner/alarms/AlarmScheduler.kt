package io.github.mecheng70.pitplanner.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * Step alarms go through AlarmManager.setAlarmClock(): the system leaves Doze for these, and they
 * are not rate-limited like setExactAndAllowWhileIdle (SPEC section 6). The set is always replaced
 * as a whole: cancel everything, then schedule the new list. Never patch alarms one at a time.
 */
object AlarmScheduler {
    const val NAG_EVERY_MS = 10 * 60_000L
    const val NAG_REPEATS = 6
    const val SNOOZE_MS = 15 * 60_000L

    data class Result(val scheduled: Int, val exact: Boolean)

    /** Replace the cook's alarm set. Test alarms are left alone. */
    fun replaceAll(ctx: Context, next: List<Alarm>): Result {
        val store = AlarmStore(ctx)
        cancelScheduled(ctx, store)
        val tests = store.alarms.filter { it.test }
        store.alarms = tests + next
        // A step that moved back into the future is scheduled again, so stop nagging it.
        val upcoming = next.flatMap { it.keys }.toSet()
        // Its notification stays in the shade until the user handles or swipes it.
        store.nags = store.nags.map { n -> n.copy(keys = n.keys.filterNot { it in upcoming }) }.filter { it.keys.isNotEmpty() }
        return scheduleStored(ctx, store)
    }

    /** End cook: nothing scheduled, nothing nagging, no notifications left. */
    fun cancelAll(ctx: Context) {
        val store = AlarmStore(ctx)
        cancelScheduled(ctx, store)
        store.alarms.forEach { Notifications.cancel(ctx, it.id) }
        store.nags.forEach { Notifications.cancel(ctx, it.alarmId) }
        store.alarms = emptyList()
        store.nags = emptyList()
        store.quietUntil = 0L
    }

    /**
     * Quiet alerts (new in the Expo port; 0.2.0 kept repeating an overdue step through Quiet). Until
     * `until`, no repeat rings: the ones due inside the window move to its end. `null` ends Quiet: a
     * repeat that was held back rings one interval from now at the latest.
     */
    fun setQuiet(ctx: Context, until: Long?) {
        val store = AlarmStore(ctx)
        val now = System.currentTimeMillis()
        store.quietUntil = until ?: 0L
        val moved = store.nags.map { n ->
            n.copy(nextAt = if (until != null) Quiet.defer(n.nextAt, until) else Quiet.release(n.nextAt, now, NAG_EVERY_MS))
        }
        store.nags = moved
        // Same PendingIntent per nag, so this replaces the alarm already set for it.
        moved.forEach { scheduleNag(ctx, it) }
    }

    /** One-off alert through the real path (setup's "Send a test alert in 10 sec", debug screen). */
    fun scheduleTest(ctx: Context, alarm: Alarm): Result {
        val store = AlarmStore(ctx)
        store.alarms = store.alarms.filterNot { it.id == alarm.id } + alarm.copy(test = true)
        return Result(1, setAlarmClock(ctx, alarm.at, firePi(ctx, alarm.id)))
    }

    /** Done for these steps (from the app or the notification): stop repeating them. */
    fun acknowledge(ctx: Context, keys: Collection<String>) {
        val store = AlarmStore(ctx)
        val kept = mutableListOf<Nag>()
        for (n in store.nags) {
            val left = n.keys.filterNot { it in keys }
            if (left.isEmpty()) {
                alarmManager(ctx).cancel(nagPi(ctx, n.alarmId))
                Notifications.cancel(ctx, n.alarmId)
            } else kept += n.copy(keys = left)
        }
        store.nags = kept
    }

    /**
     * After boot, an app update, or a clock / time zone change: schedule every stored alarm and nag
     * again. Steps whose time passed while the phone was off fire now, so nothing is silently lost.
     */
    fun restore(ctx: Context) {
        val store = AlarmStore(ctx)
        val now = System.currentTimeMillis()
        val (missed, future) = store.alarms.partition { it.at <= now }
        store.alarms = future
        for (a in missed) if (!a.test) Firing.fire(ctx, a, missed = true)
        scheduleStored(ctx, store)
    }

    /** Called when an alarm fires: start (or continue) repeating it until Done. */
    fun startNag(ctx: Context, alarm: Alarm, now: Long) {
        val store = AlarmStore(ctx)
        val nag = Nag(alarm.id, alarm.keys, alarm.title, alarm.body, 0, Quiet.defer(now + NAG_EVERY_MS, store.quietUntil))
        store.nags = store.nags.filterNot { it.alarmId == alarm.id } + nag
        setAlarmClock(ctx, nag.nextAt, nagPi(ctx, nag.alarmId))
    }

    fun scheduleNag(ctx: Context, nag: Nag) {
        setAlarmClock(ctx, nag.nextAt, nagPi(ctx, nag.alarmId))
    }

    fun snooze(ctx: Context, alarm: Alarm, now: Long) {
        val store = AlarmStore(ctx)
        val again = alarm.copy(id = "${alarm.id}~snooze", at = now + SNOOZE_MS)
        store.alarms = store.alarms.filterNot { it.id == again.id } + again
        setAlarmClock(ctx, again.at, firePi(ctx, again.id))
    }

    fun canExact(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(ctx).canScheduleExactAlarms()

    // ---- internals ----

    private fun scheduleStored(ctx: Context, store: AlarmStore): Result {
        val now = System.currentTimeMillis()
        var exact = true
        var n = 0
        for (a in store.alarms) if (a.at > now) { exact = setAlarmClock(ctx, a.at, firePi(ctx, a.id)) && exact; n++ }
        for (g in store.nags) { exact = setAlarmClock(ctx, maxOf(g.nextAt, now + 5_000), nagPi(ctx, g.alarmId)) && exact }
        return Result(n, exact)
    }

    private fun cancelScheduled(ctx: Context, store: AlarmStore) {
        val am = alarmManager(ctx)
        store.alarms.forEach { am.cancel(firePi(ctx, it.id)) }
        store.nags.forEach { am.cancel(nagPi(ctx, it.alarmId)) }
    }

    /** True when it went in as an alarm clock; false when exact alarms are denied and we fell back. */
    private fun setAlarmClock(ctx: Context, at: Long, op: PendingIntent): Boolean {
        val am = alarmManager(ctx)
        return try {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showPi(ctx)), op)
            true
        } catch (e: SecurityException) {
            // Exact alarm access revoked: an inexact alarm beats none. The app shows a red banner (failure mode 9).
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, op)
            false
        }
    }

    private fun alarmManager(ctx: Context) = ctx.getSystemService(AlarmManager::class.java)

    // The data URI makes every alarm's intent distinct, so request code 0 is fine for all of them.
    fun firePi(ctx: Context, id: String): PendingIntent = PendingIntent.getBroadcast(
        ctx, 0,
        Intent(ctx, AlarmReceiver::class.java).setAction(AlarmReceiver.FIRE).setData(Uri.parse("pitplanner://alarm/" + Uri.encode(id))),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun nagPi(ctx: Context, alarmId: String): PendingIntent = PendingIntent.getBroadcast(
        ctx, 0,
        Intent(ctx, AlarmReceiver::class.java).setAction(AlarmReceiver.NAG).setData(Uri.parse("pitplanner://nag/" + Uri.encode(alarmId))),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** Tapping the clock icon in the status bar opens the app. */
    private fun showPi(ctx: Context): PendingIntent = PendingIntent.getActivity(
        ctx, 0, Notifications.launchIntent(ctx).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
