package io.github.mecheng70.pitplanner.alarms

import android.app.Notification
import android.content.Intent
import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** What happens with the app dead: a step rings, repeats, is answered from the notification, survives a reboot. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReceiversTest : AlarmTestBase() {
  /** Schedule one step a minute out and let it ring. */
  private fun ring(id: String = "wrap", vararg keys: String = arrayOf("wrap:b:p1")): Long {
    AlarmScheduler.replaceAll(context, listOf(alarm(id, now() + min, *keys)))
    advance(min)
    deliver(scheduled().single())
    return now()
  }

  private fun action(n: Notification, title: String): Intent =
    shadowOf(n.actions.single { it.title == title }.actionIntent).savedIntent

  @Test
  fun aStepRingsWithDonePlus15AndOpenAndStartsRepeating() {
    val t = ring()
    val n = notifications().single()
    assertEquals("Title wrap", n.title())
    assertEquals("Body wrap", n.text())
    assertEquals(Notifications.CHANNEL, n.channelId)
    assertEquals(Notification.CATEGORY_ALARM, n.category)
    assertEquals(listOf("Done", "+15 min", "Open"), n.actions.map { it.title.toString() })
    // Fired, so no longer stored to fire; repeating until Done, first in 10 minutes.
    assertEquals(emptyList<Alarm>(), store.alarms)
    assertEquals(listOf(Nag("wrap", listOf("wrap:b:p1"), "Title wrap", "Body wrap", 0, t + 10 * min)), store.nags)
    assertEquals(listOf("pitplanner://nag/wrap"), targets())
    assertEquals(listOf(t + 10 * min), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun theNotificationStaysUntilHandled() {
    ring()
    // Tapping it opens the app but must not clear it: Done and +15 stay reachable.
    assertEquals(0, notifications().single().flags and Notification.FLAG_AUTO_CANCEL)
  }

  @Test
  fun anUnansweredStepRepeatsEvery10MinutesSixTimesThenAsksOnceMore() {
    ring()
    for (count in 1..6) {
      advance(10 * min)
      deliver(scheduled().single())
      val n = notifications().single()
      assertEquals("Still waiting: Title wrap", n.title())
      assertEquals("${count * 10} min past the step. Body wrap", n.text())
      assertEquals(listOf(count), store.nags.map { it.count })
      assertEquals(listOf(now() + 10 * min), scheduled().map { it.triggerAtMs })
    }
    advance(10 * min)
    deliver(scheduled().single())
    val last = notifications().single()
    assertEquals("Cook needs you", last.title())
    assertEquals("Title wrap: Body wrap", last.text())
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<String>(), targets())
  }

  @Test
  fun aTestAlarmRingsOnceAndDoesNotRepeat() {
    AlarmScheduler.scheduleTest(context, alarm("test:1", now() + 10_000))
    advance(10_000)
    deliver(scheduled().single())
    assertEquals(listOf("Title test:1"), notifications().map { it.title() })
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<Alarm>(), store.alarms)
    assertEquals(emptyList<String>(), targets())
  }

  @Test
  fun anAlarmThatIsNoLongerStoredDoesNothing() {
    AlarmScheduler.replaceAll(context, listOf(alarm("wrap", now() + min)))
    val stale = scheduled().single()
    store.alarms = emptyList()
    deliver(stale)
    assertEquals(emptyList<Any>(), notifications())
    assertEquals(emptyList<Nag>(), store.nags)
  }

  @Test
  fun doneOnTheNotificationQueuesTheActionStopsTheRepeatAndClearsIt() {
    val t = ring()
    ActionReceiver().onReceive(context, action(notifications().single(), "Done"))
    val queued = store.drainActions().single()
    assertEquals("done", queued.getString("type"))
    assertEquals("wrap", queued.getString("alarmId"))
    assertEquals(listOf("wrap:b:p1"), queued.getJSONArray("keys").strings())
    assertEquals(t, queued.getLong("at"))
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<String>(), targets())
    assertEquals(emptyList<Any>(), notifications())
  }

  @Test
  fun plus15OnTheNotificationQueuesTheActionAndRingsAgainIn15Minutes() {
    val t = ring()
    ActionReceiver().onReceive(context, action(notifications().single(), "+15 min"))
    assertEquals("snooze15", store.drainActions().single().getString("type"))
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<Any>(), notifications())
    assertEquals(listOf("pitplanner://alarm/wrap~snooze"), targets())
    assertEquals(listOf(t + 15 * min), scheduled().map { it.triggerAtMs })
    // It rings again with the step's own text and repeats like any step.
    advance(15 * min)
    deliver(scheduled().single())
    assertEquals(listOf("Title wrap"), notifications().map { it.title() })
    assertEquals(listOf(listOf("wrap:b:p1")), store.nags.map { it.keys })
  }

  @Test
  fun aBootBroadcastPutsTheStoredAlarmsBack() {
    val t = now()
    store.alarms = listOf(alarm("wrap", t + 60 * min))
    RestoreReceiver().onReceive(context, Intent(Intent.ACTION_LOCKED_BOOT_COMPLETED))
    assertEquals(listOf("pitplanner://alarm/wrap"), targets())
    assertEquals(listOf(t + 60 * min), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun theReceiversAreDeclaredNotExportedAndDirectBootAware() {
    val pm = context.packageManager
    val boot = pm.queryBroadcastReceivers(Intent(Intent.ACTION_LOCKED_BOOT_COMPLETED).setPackage(context.packageName), 0)
    assertEquals(listOf(RestoreReceiver::class.java.name), boot.map { it.activityInfo.name })
    for (cls in listOf(AlarmReceiver::class.java, ActionReceiver::class.java, RestoreReceiver::class.java)) {
      val info = pm.getReceiverInfo(android.content.ComponentName(context, cls), 0)
      assertFalse("${cls.simpleName} exported", info.exported)
      assertTrue("${cls.simpleName} directBootAware", info.directBootAware)
    }
  }

  // ---- Quiet alerts ----

  @Test
  fun aRepeatThatFiresDuringQuietIsHeldWithoutRingingOrCounting() {
    val t = ring()
    val before = notifications().single().title()
    // Quiet was set by something that did not move this repeat (e.g. stored state from before): the receiver holds it.
    store.quietUntil = t + 30 * min
    advance(10 * min)
    deliver(scheduled().single())
    assertEquals(before, notifications().single().title()) // no "Still waiting"
    assertEquals(listOf(0), store.nags.map { it.count })
    assertEquals(listOf(t + 30 * min), scheduled().map { it.triggerAtMs })
    // When the window ends it rings as the first repeat.
    advance(20 * min)
    deliver(scheduled().single())
    assertEquals("Still waiting: Title wrap", notifications().single().title())
    assertEquals(listOf(1), store.nags.map { it.count })
  }

  @Test
  fun theFireAndNagIntentsCarryTheAlarmIdEvenWithOddCharacters() {
    val id = "wrap:b:p1|pull:c:p2 x"
    AlarmScheduler.replaceAll(context, listOf(alarm(id, now() + min, "wrap:b:p1")))
    assertEquals(id, intentOf(scheduled().single()).data?.lastPathSegment?.let(Uri::decode))
    advance(min)
    deliver(scheduled().single())
    assertEquals(listOf(id), store.nags.map { it.alarmId })
  }
}
