package io.github.mecheng70.pitplanner.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowAlarmManager

/** The alarm invariants of TECH-DESIGN section 6 that live in the scheduler. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AlarmSchedulerTest : AlarmTestBase() {
  @Test
  fun replaceAllSchedulesExactlyTheNewSetAsAlarmClocks() {
    val t = now()
    val r = AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + 10 * min), alarm("wrap", t + 60 * min)))
    assertEquals(AlarmScheduler.Result(2, true), r)
    assertEquals(listOf("pitplanner://alarm/fire", "pitplanner://alarm/wrap"), targets())
    assertEquals(listOf(t + 10 * min, t + 60 * min), scheduled().map { it.triggerAtMs })
    // setAlarmClock, not an inexact or idle-limited alarm: the system leaves Doze for these.
    scheduled().forEach { assertNotNull(it.alarmClockInfo) }
    assertEquals(listOf("fire", "wrap"), store.alarms.map { it.id })
  }

  @Test
  fun replaceAllReplacesTheWholeSetAndNeverPatches() {
    val t = now()
    AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + 10 * min), alarm("wrap", t + 60 * min)))
    AlarmScheduler.replaceAll(context, listOf(alarm("wrap", t + 90 * min), alarm("pull", t + 120 * min)))
    assertEquals(listOf("pitplanner://alarm/wrap", "pitplanner://alarm/pull"), targets())
    assertEquals(listOf(t + 90 * min, t + 120 * min), scheduled().map { it.triggerAtMs })
    assertEquals(listOf("wrap", "pull"), store.alarms.map { it.id })
  }

  @Test
  fun schedulingTheSameSetTwiceLeavesOneAlarmPerStep() {
    val t = now()
    val set = listOf(alarm("fire", t + 10 * min), alarm("wrap", t + 60 * min))
    AlarmScheduler.replaceAll(context, set)
    AlarmScheduler.replaceAll(context, set)
    assertEquals(2, scheduled().size)
  }

  @Test
  fun aStepWhoseTimeHasPassedIsNotScheduled() {
    val t = now()
    val r = AlarmScheduler.replaceAll(context, listOf(alarm("late", t - min), alarm("wrap", t + 60 * min)))
    assertEquals(1, r.scheduled)
    assertEquals(listOf("pitplanner://alarm/wrap"), targets())
  }

  @Test
  fun replaceAllLeavesATestAlarmAlone() {
    val t = now()
    AlarmScheduler.scheduleTest(context, alarm("test:1", t + 10_000))
    AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + 10 * min)))
    assertEquals(listOf("pitplanner://alarm/test%3A1", "pitplanner://alarm/fire"), targets())
    assertEquals(listOf(true, false), store.alarms.map { it.test })
  }

  @Test
  fun aStepScheduledAgainStopsRepeating() {
    val t = now()
    store.nags = listOf(Nag("a", listOf("wrap:b:p1", "pull:b:p2"), "T", "B", 1, t + 5 * min), Nag("b", listOf("fire::"), "T", "B", 0, t + 5 * min))
    // The replan moved the wrap and the fire back into the future.
    AlarmScheduler.replaceAll(context, listOf(alarm("x", t + 30 * min, "wrap:b:p1", "fire::")))
    assertEquals(listOf(listOf("pull:b:p2")), store.nags.map { it.keys })
    assertEquals(listOf("pitplanner://nag/a", "pitplanner://alarm/x"), targets())
  }

  @Test
  fun cancelAllLeavesNothingScheduledStoredShownOrQuiet() {
    val t = now()
    AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + min), alarm("wrap", t + 60 * min)))
    advance(min)
    deliver(scheduled().first()) // fire rings: a notification and a repeat
    AlarmScheduler.setQuiet(context, now() + 30 * min)
    assertEquals(1, notifications().size)
    AlarmScheduler.cancelAll(context)
    assertEquals(emptyList<String>(), targets())
    assertEquals(emptyList<Alarm>(), store.alarms)
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<Any>(), notifications())
    assertEquals(0L, store.quietUntil)
  }

  @Test
  fun afterARebootEveryStoredAlarmAndRepeatIsScheduledAgain() {
    val t = now()
    // What the store holds when the phone comes back up: AlarmManager itself is empty.
    store.alarms = listOf(alarm("wrap", t + 60 * min), alarm("pull", t + 120 * min))
    store.nags = listOf(Nag("fire", listOf("fire::"), "Fire", "B", 2, t + 4 * min))
    AlarmScheduler.restore(context)
    assertEquals(listOf("pitplanner://nag/fire", "pitplanner://alarm/wrap", "pitplanner://alarm/pull"), targets())
    assertEquals(listOf(t + 4 * min, t + 60 * min, t + 120 * min), scheduled().map { it.triggerAtMs })
    scheduled().forEach { assertNotNull(it.alarmClockInfo) }
  }

  @Test
  fun aStepMissedWhileThePhoneWasOffRingsAtOnceAndKeepsRepeating() {
    val t = now()
    store.alarms = listOf(alarm("wrap", t - 20 * min, "wrap:b:p1"), alarm("pull", t + 120 * min))
    AlarmScheduler.restore(context)
    assertEquals(listOf("Title wrap"), notifications().map { it.title() })
    assertEquals("Missed while the phone was off. Body wrap", notifications().single().text())
    assertEquals(listOf("pull"), store.alarms.map { it.id })
    assertEquals(listOf("wrap"), store.nags.map { it.alarmId })
    assertEquals(listOf("pitplanner://nag/wrap", "pitplanner://alarm/pull"), targets())
  }

  @Test
  fun aRepeatThatCameDueWhileThePhoneWasOffRingsShortlyAfterBoot() {
    val t = now()
    store.nags = listOf(Nag("fire", listOf("fire::"), "Fire", "B", 1, t - 3 * min))
    AlarmScheduler.restore(context)
    assertEquals(listOf(t + 5_000), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun doneForAStepStopsItsRepeatAndClearsItsNotification() {
    val t = now()
    AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + min, "fire::"), alarm("wrap", t + 2 * min, "wrap:b:p1", "wrap:c:p1")))
    advance(2 * min)
    scheduled().forEach { deliver(it) }
    assertEquals(2, notifications().size)
    AlarmScheduler.acknowledge(context, listOf("fire::", "wrap:b:p1"))
    // The fire is done. One of the two wraps is not, so that alarm keeps repeating for it.
    assertEquals(listOf(listOf("wrap:c:p1")), store.nags.map { it.keys })
    assertEquals(listOf("pitplanner://nag/wrap"), targets())
    assertEquals(listOf("Title wrap"), notifications().map { it.title() })
  }

  @Test
  fun plus15RingsAgainIn15MinutesEvenIfTheAppNeverOpens() {
    val t = now()
    AlarmScheduler.snooze(context, alarm("wrap", t, "wrap:b:p1"), t)
    assertEquals(listOf("pitplanner://alarm/wrap~snooze"), targets())
    assertEquals(listOf(t + 15 * min), scheduled().map { it.triggerAtMs })
    // A second +15 on the same step replaces the first.
    AlarmScheduler.snooze(context, alarm("wrap", t, "wrap:b:p1"), t + min)
    assertEquals(listOf(t + 16 * min), scheduled().map { it.triggerAtMs })
    assertEquals(1, store.alarms.size)
  }

  @Test
  @Config(sdk = [35], shadows = [ExactAlarmsDenied::class])
  fun withExactAlarmsDeniedAnInexactAlarmIsSetAndTheResultSaysSo() {
    val t = now()
    val r = AlarmScheduler.replaceAll(context, listOf(alarm("fire", t + 10 * min)))
    // An inexact alarm beats none; the app shows its red banner from `exact = false`.
    assertEquals(AlarmScheduler.Result(1, false), r)
    assertEquals(listOf("pitplanner://alarm/fire"), targets())
    assertEquals(listOf(t + 10 * min), scheduled().map { it.triggerAtMs })
    assertNull(scheduled().single().alarmClockInfo)
  }

  @Test
  fun canExactFollowsTheSystemSetting() {
    ShadowAlarmManager.setCanScheduleExactAlarms(false)
    try {
      assertFalse(AlarmScheduler.canExact(context))
    } finally {
      ShadowAlarmManager.setCanScheduleExactAlarms(true)
    }
    assertTrue(AlarmScheduler.canExact(context))
  }

  // ---- Quiet alerts (regression for the 0.2.0 gap: an overdue step kept repeating through Quiet) ----

  @Test
  fun quietMovesARepeatDueInsideTheWindowToItsEnd() {
    val t = now()
    store.nags = listOf(Nag("fire", listOf("fire::"), "Fire", "B", 1, t + 4 * min), Nag("wrap", listOf("wrap:b:p1"), "Wrap", "B", 0, t + 45 * min))
    AlarmScheduler.restore(context)
    AlarmScheduler.setQuiet(context, t + 30 * min)
    assertEquals(t + 30 * min, store.quietUntil)
    assertEquals(listOf(t + 30 * min, t + 45 * min), store.nags.map { it.nextAt })
    // Rescheduled, not added: still one alarm per repeat.
    assertEquals(listOf("pitplanner://nag/fire", "pitplanner://nag/wrap"), targets())
    assertEquals(listOf(t + 30 * min, t + 45 * min), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun aStepThatRingsDuringQuietStartsRepeatingOnlyAfterTheWindow() {
    val t = now()
    AlarmScheduler.setQuiet(context, t + 30 * min)
    AlarmScheduler.startNag(context, alarm("fire", t, "fire::"), t)
    assertEquals(listOf(t + 30 * min), store.nags.map { it.nextAt })
    assertEquals(listOf(t + 30 * min), scheduled().map { it.triggerAtMs })
  }

  @Test
  fun endingQuietEarlyBringsHeldRepeatsBack() {
    val t = now()
    store.nags = listOf(Nag("fire", listOf("fire::"), "Fire", "B", 1, t + 4 * min))
    AlarmScheduler.setQuiet(context, t + 30 * min)
    advance(5 * min)
    AlarmScheduler.setQuiet(context, null)
    assertEquals(0L, store.quietUntil)
    assertEquals(listOf(now() + 10 * min), store.nags.map { it.nextAt })
    assertEquals(listOf(now() + 10 * min), scheduled().map { it.triggerAtMs })
  }
}

/** AlarmManager as it behaves once exact alarm access is revoked: setAlarmClock throws. */
@Implements(AlarmManager::class)
class ExactAlarmsDenied : ShadowAlarmManager() {
  @Implementation
  public override fun setAlarmClock(info: AlarmManager.AlarmClockInfo, operation: PendingIntent) {
    throw SecurityException("exact alarms denied")
  }
}
