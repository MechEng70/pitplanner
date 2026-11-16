package io.github.mecheng70.pitplanner.alarms

import android.content.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** T-034 parity review, docs/parity.md section 1b rows T6, T14 and T15. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ParityTest : AlarmTestBase() {
  /** Schedule one step a minute out and let it ring. */
  private fun ring(id: String = "wrap", vararg keys: String = arrayOf("wrap:b:p1")): Long {
    AlarmScheduler.replaceAll(context, listOf(alarm(id, now() + min, *keys)))
    advance(min)
    deliver(scheduled().single())
    return now()
  }

  /** The receivers the module manifest registers for a system broadcast. */
  private fun receiversFor(action: String): List<String> =
    context.packageManager
      .queryBroadcastReceivers(Intent(action).setPackage(context.packageName), 0)
      .map { it.activityInfo.name }

  // ---- T6: a tap on the alert opens the app ----

  @Test
  fun aTapOnTheAlertStartsThisAppsActivityInANewTask() {
    // Catches: the content intent dropped, turned into a broadcast (a tap that acts like Done), aimed at
    // another package, or started without NEW_TASK (it is started from outside any activity).
    ring()
    val n = notifications().single()
    val tap = shadowOf(n.contentIntent)
    assertTrue("the content intent starts an activity", tap.isActivityIntent)
    assertFalse("the content intent is not a broadcast", tap.isBroadcastIntent)
    val opened = tap.savedIntent
    assertEquals(context.packageName, opened.`package` ?: opened.component?.packageName)
    assertTrue("NEW_TASK", opened.flags and Intent.FLAG_ACTIVITY_NEW_TASK != 0)
    assertEquals("wrap", opened.getStringExtra(Notifications.EXTRA_ALARM))
    // Opening is the tap itself: no action button opens the app.
    n.actions.forEach { assertFalse("${it.title} opens an activity", shadowOf(it.actionIntent).isActivityIntent) }
  }

  @Test
  fun aRepeatOfTheAlertAlsoOpensTheAppOnATap() {
    // Catches: the repeats ("Still waiting") built without the content intent.
    ring()
    advance(10 * min)
    deliver(scheduled().single())
    val n = notifications().single()
    assertEquals("Still waiting: Title wrap", n.title())
    assertTrue(shadowOf(n.contentIntent).isActivityIntent)
    assertEquals("wrap", shadowOf(n.contentIntent).savedIntent.getStringExtra(Notifications.EXTRA_ALARM))
  }

  // ---- T14 and T15: the restore receiver's manifest entries ----

  @Test
  fun theRestoreReceiverIsRegisteredForEveryEventThatWipesOrMovesAlarms() {
    // Catches: one of these actions dropped from the module's AndroidManifest.xml intent filter.
    val actions = listOf(
      Intent.ACTION_LOCKED_BOOT_COMPLETED,
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED, // "android.intent.action.TIME_SET"
      Intent.ACTION_TIMEZONE_CHANGED,
    )
    for (action in actions) {
      assertEquals(action, listOf(RestoreReceiver::class.java.name), receiversFor(action))
    }
  }

  @Test
  fun aClockChangePutsTheStoredAlarmsBackAtTheSameInstants() {
    // Catches: RestoreReceiver ignoring TIME_SET (for example a filter on the action) or rescheduling at a
    // shifted time. Instants are epoch ms, so the trigger times do not move when the clock is set.
    val t = now()
    store.alarms = listOf(alarm("wrap", t + 60 * min), alarm("pull", t + 120 * min))
    RestoreReceiver().onReceive(context, Intent(Intent.ACTION_TIME_CHANGED))
    assertEquals(listOf("pitplanner://alarm/wrap", "pitplanner://alarm/pull"), targets())
    assertEquals(listOf(t + 60 * min, t + 120 * min), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun aTimeZoneChangeOrAnAppUpdatePutsTheStoredAlarmsBack() {
    // Catches: RestoreReceiver acting on boot only.
    val actions = listOf(Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_BOOT_COMPLETED)
    actions.forEachIndexed { i, action ->
      // A step of its own for each broadcast, so one put back by an earlier broadcast cannot pass for it.
      val id = "step$i"
      val at = now() + (60 + i) * min
      store.alarms = listOf(alarm(id, at))
      RestoreReceiver().onReceive(context, Intent(action))
      val mine = scheduled().filter { intentOf(it).data.toString() == "pitplanner://alarm/$id" }
      assertEquals(action, listOf(at), mine.map { it.triggerAtMs })
    }
  }
}
