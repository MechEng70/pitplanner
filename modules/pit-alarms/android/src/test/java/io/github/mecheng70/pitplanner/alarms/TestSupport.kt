package io.github.mecheng70.pitplanner.alarms

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import org.junit.After
import org.junit.Before
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowAlarmManager

/** Shared by the alarm tests: the app context, what AlarmManager holds, what the shade shows, the clock. */
abstract class AlarmTestBase {
  protected val context: Context = RuntimeEnvironment.getApplication()
  protected val store get() = AlarmStore(context)
  protected val min = 60_000L

  /** The clock the alarm code reads (Clock.source), moved only by `advance`. */
  private var clockMs = 1_800_000_000_000L

  @Before
  fun useTestClock() {
    Clock.source = { clockMs }
  }

  @After
  fun useRealClock() {
    Clock.source = { System.currentTimeMillis() }
  }

  protected fun now() = clockMs
  protected fun advance(ms: Long) {
    clockMs += ms
  }

  protected fun alarm(id: String, at: Long, vararg keys: String, critical: Boolean = false) =
    Alarm(id, at, "Title $id", "Body $id", critical, keys.toList().ifEmpty { listOf(id) })

  /** Everything set in AlarmManager, soonest first. */
  protected fun scheduled(): List<ShadowAlarmManager.ScheduledAlarm> =
    shadowOf(context.getSystemService(AlarmManager::class.java)).scheduledAlarms.sortedBy { it.triggerAtMs }

  /** The intent a scheduled alarm delivers: `pitplanner://alarm/<id>` to fire, `pitplanner://nag/<id>` to repeat. */
  protected fun intentOf(a: ShadowAlarmManager.ScheduledAlarm): Intent = shadowOf(a.operation!!).savedIntent
  protected fun targets(): List<String> = scheduled().map { intentOf(it).data.toString() }

  /** Deliver a scheduled alarm to its receiver, as AlarmManager would at its time. */
  protected fun deliver(a: ShadowAlarmManager.ScheduledAlarm) {
    a.operation?.let(context.getSystemService(AlarmManager::class.java)::cancel)
    AlarmReceiver().onReceive(context, intentOf(a))
  }

  protected fun notifications(): List<Notification> =
    shadowOf(context.getSystemService(NotificationManager::class.java)).allNotifications

  protected fun Notification.title(): String? = extras.getString(Notification.EXTRA_TITLE)
  protected fun Notification.text(): String? = extras.getString(Notification.EXTRA_TEXT)
}
