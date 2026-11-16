package io.github.mecheng70.pitplanner.alarms

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * T-068: every ring the phone makes is logged natively, with the app dead too: when the step was due, when it
 * rang, which repeat, and how it came to ring. Keys and times only.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class RingLogTest : AlarmTestBase() {
  /** Schedule one step a minute out and let it ring `lateMs` after its time. */
  private fun ring(id: String = "wrap", key: String = "wrap:b:p1", lateMs: Long = 0L): Long {
    val at = now() + min
    AlarmScheduler.replaceAll(context, listOf(alarm(id, at, key)))
    advance(min + lateMs)
    deliver(scheduled().single())
    return at
  }

  private fun action(n: Notification, title: String): Intent =
    shadowOf(n.actions.single { it.title == title }.actionIntent).savedIntent

  private fun ringRecord(id: String, keys: List<String>, planned: Long, actual: Long, repeat: Int = 0, source: String = "alarm") =
    Ring(id, keys, planned, actual, elapsed(), repeat, last = false, source = source, test = false, idle = false, interactive = true, posted = true)

  private fun power() = shadowOf(context.getSystemService(PowerManager::class.java))

  @Test
  fun aFiredAlarmLogsWhenItWasDueAndWhenItRang() {
    power().turnScreenOn(true)
    power().setIsDeviceIdleMode(false)
    val due = ring(lateMs = 3_000L)
    assertEquals(listOf(ringRecord("wrap", listOf("wrap:b:p1"), due, now())), rings)
    assertEquals(3_000L, rings.single().actualAt - rings.single().plannedAt)
  }

  @Test
  fun theLogHoldsKeysAndTimesButNoStepText() {
    ring()
    val stored = context.createDeviceProtectedStorageContext()
      .getSharedPreferences(RingLog.NAME, Context.MODE_PRIVATE).all.values.joinToString()
    assertTrue(stored.contains("wrap:b:p1"))
    assertFalse(stored.contains("Title wrap"))
    assertFalse(stored.contains("Body wrap"))
  }

  @Test
  fun theLogLivesInDeviceProtectedStorageSoARingBeforeTheFirstUnlockIsKept() {
    ring()
    val prefs = context.createDeviceProtectedStorageContext().getSharedPreferences(RingLog.NAME, Context.MODE_PRIVATE)
    assertTrue(prefs.getString("rings", "")!!.contains("\"wrap\""))
  }

  @Test
  fun repeatsCountUpEachDueAtItsOwnTimeAndTheLastIsMarked() {
    val due = ring()
    val planned = mutableListOf(due)
    for (i in 1..7) {
      planned += store.nags.single().nextAt
      advance(10 * min + 1_000L)
      deliver(scheduled().single())
    }
    assertEquals("Cook needs you", notifications().single().extras.getString(Notification.EXTRA_TITLE))
    assertEquals((0..7).toList(), rings.map { it.repeat })
    assertEquals(List(7) { false } + true, rings.map { it.last })
    assertEquals(planned, rings.map { it.plannedAt })
    // Each repeat rang a second after it was due.
    assertEquals(listOf(0L) + List(7) { 1_000L }, rings.map { it.actualAt - it.plannedAt })
    assertTrue(rings.all { it.source == "alarm" && it.alarmId == "wrap" && it.keys == listOf("wrap:b:p1") })
  }

  @Test
  fun aRepeatHeldByQuietIsNotARing() {
    val due = ring()
    store.quietUntil = due + 30 * min
    advance(10 * min)
    deliver(scheduled().single())
    assertEquals(listOf(0), rings.map { it.repeat })
  }

  @Test
  fun anAlarmFiredByTheRestoreAfterABootIsMarkedRestoreWithItsOwnDueTime() {
    val due = now() - 20 * min
    store.alarms = listOf(alarm("wrap", due, "wrap:b:p1"), alarm("rest", now() + 60 * min, "rest:b"))
    RestoreReceiver().onReceive(context, Intent(Intent.ACTION_LOCKED_BOOT_COMPLETED))
    val r = rings.single()
    assertEquals("restore", r.source)
    assertEquals("wrap", r.alarmId)
    assertEquals(due, r.plannedAt)
    assertEquals(now(), r.actualAt)
    assertEquals(20 * min, r.actualAt - r.plannedAt)
  }

  @Test
  fun aPlus15RingIsMarkedSnoozeAndSoAreItsRepeats() {
    ring()
    ActionReceiver().onReceive(context, action(notifications().single(), "+15 min"))
    val due = scheduled().single().triggerAtMs
    advance(15 * min)
    deliver(scheduled().single())
    advance(10 * min)
    deliver(scheduled().single())
    assertEquals(listOf("alarm", "snooze", "snooze"), rings.map { it.source })
    assertEquals(listOf("wrap", "wrap~snooze", "wrap~snooze"), rings.map { it.alarmId })
    assertEquals(listOf(0, 0, 1), rings.map { it.repeat })
    assertEquals(due, rings[1].plannedAt)
    assertTrue(rings.all { it.keys == listOf("wrap:b:p1") })
  }

  @Test
  fun aTestAlarmIsLoggedAndMarkedTest() {
    AlarmScheduler.scheduleTest(context, alarm("test:1", now() + 10_000))
    advance(10_000)
    deliver(scheduled().single())
    assertEquals(listOf(true), rings.map { it.test })
    assertEquals(listOf("alarm"), rings.map { it.source })
  }

  @Test
  fun theElapsedClockIsLoggedSoAClockChangeCanBeToldFromLateness() {
    val due = ring()
    val first = rings.single()
    // Someone sets the wall clock back an hour; the elapsed clock does not move back.
    setWallClock(now() - 60 * min)
    advance(10 * min)
    deliver(scheduled().single())
    val second = rings[1]
    assertEquals(due, first.plannedAt)
    assertEquals(10 * min, second.elapsedRealtime - first.elapsedRealtime)
  }

  @Test
  fun theScreenAndIdleStateAtTheRingAreLogged() {
    power().turnScreenOn(false)
    power().setIsDeviceIdleMode(true)
    ring()
    assertEquals(false, rings.single().interactive)
    assertEquals(true, rings.single().idle)
  }

  @Test
  fun theCapDropsTheOldestFirst() {
    val log = RingLog(context)
    val extra = 7
    repeat(RingLog.CAP + extra) { log.append(Ring("a$it", listOf("k$it"), it.toLong(), it.toLong(), 0L, 0, false, "alarm", false, null, null, true)) }
    val kept = RingLog(context).all()
    assertEquals(RingLog.CAP, kept.size)
    assertEquals("a$extra", kept.first().alarmId)
    assertEquals("a${RingLog.CAP + extra - 1}", kept.last().alarmId)
  }

  @Test
  fun appendsFromSeveralThreadsWhileTheAppReadsLoseNothing() {
    // Receivers append on the main thread while the module reads on its own; each RingLog is a new instance.
    val writers = 4
    val perWriter = 100
    val start = CountDownLatch(1)
    val done = AtomicBoolean(false)
    val sizes = Collections.synchronizedList(mutableListOf<Int>())
    val threads = List(writers) { w ->
      thread {
        start.await()
        repeat(perWriter) {
          RingLog(context).append(Ring("w$w-$it", listOf("k"), 1L, 2L, 3L, 0, false, "alarm", false, null, null, true))
        }
      }
    }
    val app = thread {
      start.await()
      while (!done.get()) sizes += RingLog(context).all().size
    }
    start.countDown()
    threads.forEach { it.join(30_000) }
    done.set(true)
    app.join(30_000)
    assertFalse(app.isAlive)
    val all = RingLog(context).all().map { it.alarmId }
    assertEquals(writers * perWriter, all.size)
    assertEquals(writers * perWriter, all.toSet().size)
    // Reads never see the log shrink.
    assertEquals(sizes, sizes.sorted())
  }

  @Test
  fun aLogThatCannotBeWrittenNeverStopsTheRingOrItsRepeats() {
    RingLog.open = { throw IllegalStateException("disk full") }
    val due = ring()
    assertEquals("Title wrap", notifications().single().extras.getString(Notification.EXTRA_TITLE))
    assertEquals(listOf(due + 10 * min), store.nags.map { it.nextAt })
    assertEquals(listOf("pitplanner://nag/wrap"), targets())
    // A repeat still rings too.
    advance(10 * min)
    deliver(scheduled().single())
    assertEquals("Still waiting: Title wrap", notifications().single().extras.getString(Notification.EXTRA_TITLE))
  }

  @Test
  fun unreadableStoredTextReadsAsAnEmptyLogAndTheNextRingStillLogs() {
    val prefs = context.createDeviceProtectedStorageContext().getSharedPreferences(RingLog.NAME, Context.MODE_PRIVATE)
    assertTrue(prefs.edit().putString("rings", "{not json").commit())
    assertEquals(emptyList<Ring>(), rings)
    ring()
    assertEquals(listOf("wrap"), rings.map { it.alarmId })
  }

  @Test
  fun replanningEndingTheCookAndRestoringLeaveTheLog() {
    ring()
    AlarmScheduler.replaceAll(context, listOf(alarm("rest", now() + 60 * min, "rest:b")))
    assertEquals(listOf("wrap"), rings.map { it.alarmId })
    AlarmScheduler.replaceAll(context, emptyList())
    AlarmScheduler.cancelAll(context)
    RestoreReceiver().onReceive(context, Intent(Intent.ACTION_BOOT_COMPLETED))
    assertEquals(listOf("wrap"), rings.map { it.alarmId })
  }

  @Test
  fun clearEmptiesTheLog() {
    ring()
    RingLog(context).clear()
    assertEquals(emptyList<Ring>(), rings)
  }

  @Test
  fun aRecordReadsBackAsWrittenWithUnknownsAsNull() {
    val r = Ring("a", listOf("k1", "k2"), 10L, 25L, 99L, 3, true, "snooze", true, null, false, false)
    RingLog(context).append(r)
    assertEquals(listOf(r), RingLog(context).all())
    val json = r.toJson()
    assertTrue(json.isNull("idle"))
    assertNull(Ring.fromJson(json).idle)
  }
}
