package io.github.mecheng70.pitplanner.alarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri

/** What happens when a step's time comes: notify, tell the app if it is open, start repeating. */
object Firing {
    fun fire(ctx: Context, alarm: Alarm, missed: Boolean = false) {
        val now = System.currentTimeMillis()
        val body = if (missed) "Missed while the phone was off. ${alarm.body}" else alarm.body
        Notifications.show(ctx, alarm.id, alarm.keys, alarm.title, body, alarm.critical, repeat = 0)
        PitAlarmsModule.emit(PitAlarmsModule.EVENT_FIRED, alarm.id, alarm.keys)
        if (!alarm.test) AlarmScheduler.startNag(ctx, alarm, now)
    }
}

/** setAlarmClock() targets: a step firing, or a nag repeat of a step nobody tapped Done on. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.data?.lastPathSegment?.let(Uri::decode) ?: return
        val store = AlarmStore(ctx)
        when (intent.action) {
            FIRE -> {
                val alarm = store.alarms.find { it.id == id } ?: return
                store.alarms = store.alarms.filterNot { it.id == id }
                Firing.fire(ctx, alarm)
            }
            NAG -> {
                val nag = store.nags.find { it.alarmId == id } ?: return
                val now = System.currentTimeMillis()
                if (Quiet.active(now, store.quietUntil)) {
                    // Quiet alerts: hold this repeat until the window ends; it does not count as one.
                    val held = nag.copy(nextAt = store.quietUntil)
                    store.nags = store.nags.map { if (it.alarmId == id) held else it }
                    AlarmScheduler.scheduleNag(ctx, held)
                    return
                }
                val count = nag.count + 1
                if (count <= AlarmScheduler.NAG_REPEATS) {
                    val next = nag.copy(count = count, nextAt = now + AlarmScheduler.NAG_EVERY_MS)
                    store.nags = store.nags.map { if (it.alarmId == id) next else it }
                    Notifications.show(ctx, id, nag.keys, nag.title, nag.body, critical = true, repeat = count)
                    AlarmScheduler.scheduleNag(ctx, next)
                } else {
                    // Six repeats unanswered: one last alert, then stop. Live Cook keeps showing the step overdue.
                    store.nags = store.nags.filterNot { it.alarmId == id }
                    Notifications.show(ctx, id, nag.keys, "Cook needs you", "${nag.title}: ${nag.body}", critical = true, repeat = count)
                }
            }
        }
    }

    companion object {
        const val FIRE = "io.github.mecheng70.pitplanner.FIRE"
        const val NAG = "io.github.mecheng70.pitplanner.NAG"
    }
}

/** Done and +15 min from the notification. The app applies them to the plan next time it runs. */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val keys = intent.getStringArrayListExtra(EXTRA_KEYS) ?: arrayListOf()
        val now = System.currentTimeMillis()
        val store = AlarmStore(ctx)
        AlarmScheduler.acknowledge(ctx, keys)
        Notifications.cancel(ctx, id)
        when (intent.action) {
            DONE -> {
                store.queueAction("done", id, keys, now)
                PitAlarmsModule.emit(PitAlarmsModule.EVENT_ACTION, id, keys, "done")
            }
            SNOOZE -> {
                // Ring again in 15 min even if the app never opens; the app shifts the plan when it does.
                val step = Alarm(id, now, intent.getStringExtra(EXTRA_TITLE) ?: "", intent.getStringExtra(EXTRA_BODY) ?: "", true, keys)
                AlarmScheduler.snooze(ctx, step, now)
                store.queueAction("snooze15", id, keys, now)
                PitAlarmsModule.emit(PitAlarmsModule.EVENT_ACTION, id, keys, "snooze15")
            }
        }
    }

    companion object {
        const val DONE = "io.github.mecheng70.pitplanner.DONE"
        const val SNOOZE = "io.github.mecheng70.pitplanner.SNOOZE"
        const val EXTRA_ID = "alarmId"
        const val EXTRA_KEYS = "keys"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
    }
}

/**
 * Alarms do not survive a reboot, and an app update clears them too. Reschedule from the stored set
 * on boot, on update, when exact alarm access comes back, and when the clock or time zone changes
 * (instants are epoch ms, so the times themselves do not move).
 */
class RestoreReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        AlarmScheduler.restore(ctx)
    }
}
