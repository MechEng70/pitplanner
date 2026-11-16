package io.github.mecheng70.pitplanner.alarms

import android.content.Context
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** What the native side keeps with the app dead: the alarm set, open repeats, queued actions, Quiet. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AlarmStoreTest : AlarmTestBase() {
  private fun ids(actions: List<JSONObject>) = actions.map { it.getString("id") }

  @Test
  fun alarmsAndRepeatsReadBackAsSaved() {
    val alarms = listOf(alarm("fire", 1_000L, "fire::", critical = true), alarm("wrap", 2_000L, "wrap:b:p1", "wrap:c:p1"))
    val nags = listOf(Nag("fire", listOf("fire::"), "Fire the smoker", "To 225F.", 2, 3_000L))
    store.alarms = alarms
    store.nags = nags
    // A new instance, as a receiver started in a fresh process would make.
    assertEquals(alarms, AlarmStore(context).alarms)
    assertEquals(nags, AlarmStore(context).nags)
  }

  @Test
  fun anEmptyStoreHasNothingAndQuietIsOff() {
    assertEquals(emptyList<Alarm>(), store.alarms)
    assertEquals(emptyList<Nag>(), store.nags)
    assertEquals(emptyList<Any>(), store.peekActions())
    assertEquals(0, store.ackActions(listOf("nothing")))
    assertEquals(0L, store.quietUntil)
  }

  @Test
  fun queuedActionsAreReadInOrderAndKeptUntilAcknowledged() {
    store.queueAction("done", "fire", listOf("fire::"), 10L)
    store.queueAction("snooze15", "wrap", listOf("wrap:b:p1"), 20L)
    val read = store.peekActions()
    assertEquals(listOf("done", "snooze15"), read.map { it.getString("type") })
    assertEquals(listOf("fire", "wrap"), read.map { it.getString("alarmId") })
    assertEquals(listOf("wrap:b:p1"), read[1].getJSONArray("keys").strings())
    assertEquals(20L, read[1].getLong("at"))
    // T-079: reading removes nothing. A new instance, as the app after a crash would make, reads the same ids.
    assertEquals(ids(read), ids(AlarmStore(context).peekActions()))
    assertEquals(2, store.ackActions(ids(read)))
    assertEquals(emptyList<Any>(), store.peekActions())
  }

  @Test
  fun acknowledgeRemovesOnlyTheIdsGiven() {
    val a = store.queueAction("done", "fire", listOf("fire::"), 10L)
    val b = store.queueAction("snooze15", "wrap", listOf("wrap:b:p1"), 20L)
    val c = store.queueAction("done", "rest", listOf("rest:b"), 30L)
    assertEquals(2, store.ackActions(listOf(a, c, "not-queued")))
    assertEquals(listOf(b), ids(store.peekActions()))
    // Acknowledging again is harmless (a second read of the same taps).
    assertEquals(0, store.ackActions(listOf(a, c)))
    assertEquals(listOf(b), ids(store.peekActions()))
  }

  @Test
  fun aTapQueuedBetweenTheReadAndTheAcknowledgeIsKept() {
    // T-079 regression: the old drain read the queue and then wrote it empty, so this tap was lost.
    store.queueAction("done", "fire", listOf("fire::"), 10L)
    val read = store.peekActions()
    val late = store.queueAction("snooze15", "wrap", listOf("wrap:b:p1"), 20L)
    store.ackActions(ids(read))
    val left = store.peekActions()
    assertEquals(listOf(late), ids(left))
    assertEquals("snooze15", left.single().getString("type"))
  }

  @Test
  fun everyQueuedTapGetsItsOwnId() {
    val queued = List(200) { store.queueAction("done", "a$it", listOf("k$it"), it.toLong()) }
    assertEquals(200, queued.toSet().size)
    assertTrue(queued.all { it.isNotEmpty() })
    assertEquals(queued, ids(store.peekActions()))
  }

  @Test
  fun tapsQueuedByAnEarlierBuildWithoutIdsGetOneThatStays() {
    val prefs = context.createDeviceProtectedStorageContext().getSharedPreferences("pit_alarms", Context.MODE_PRIVATE)
    val old = """[{"type":"done","alarmId":"fire","keys":["fire::"],"at":10},{"type":"done","alarmId":"wrap","keys":["wrap:b:p1"],"at":20}]"""
    assertTrue(prefs.edit().putString("actions", old).commit())
    val first = ids(store.peekActions())
    assertEquals(2, first.toSet().size)
    assertTrue(first.all { it.isNotEmpty() })
    assertEquals(first, ids(AlarmStore(context).peekActions()))
    assertEquals(1, store.ackActions(first.take(1)))
    assertEquals(first.drop(1), ids(store.peekActions()))
  }

  @Test
  fun tapsQueuedWhileTheAppReadsAndAcknowledgesAreNeverLost() {
    // Receivers queue on the main thread while the module reads and acknowledges on its own (T-079). Without
    // the lock, a write of the queue made from an older read drops the taps queued in between.
    val writers = 4
    val perWriter = 100
    val stores = List(writers) { AlarmStore(context) }
    val reader = AlarmStore(context)
    val start = CountDownLatch(1)
    val done = AtomicBoolean(false)
    val seen = Collections.synchronizedList(mutableListOf<String>())
    val queued = Collections.synchronizedList(mutableListOf<String>())
    val threads = stores.mapIndexed { w, s ->
      thread {
        start.await()
        repeat(perWriter) { queued += s.queueAction("done", "w$w", listOf("k$it"), it.toLong()) }
      }
    }
    val app = thread {
      start.await()
      while (!done.get()) {
        val read = ids(reader.peekActions())
        seen += read
        reader.ackActions(read)
      }
    }
    start.countDown()
    threads.forEach { it.join(30_000) }
    done.set(true)
    app.join(30_000)
    assertFalse(app.isAlive)
    seen += ids(reader.peekActions())
    assertEquals(writers * perWriter, queued.toSet().size)
    // Every tap read exactly once: none lost, none handed over twice after its acknowledge.
    assertEquals(queued.toSet(), seen.toSet())
    assertEquals(seen.size, seen.toSet().size)
  }

  @Test
  fun quietUntilIsKept() {
    store.quietUntil = 123_456L
    assertEquals(123_456L, AlarmStore(context).quietUntil)
  }

  @Test
  fun unreadableStoredTextReadsAsNothingInsteadOfCrashingAReceiver() {
    val prefs = context.createDeviceProtectedStorageContext().getSharedPreferences("pit_alarms", Context.MODE_PRIVATE)
    assertTrue(prefs.edit().putString("alarms", "{not json").putString("nags", "[1,2]").commit())
    assertEquals(emptyList<Alarm>(), store.alarms)
    assertEquals(emptyList<Nag>(), store.nags)
  }

  @Test
  fun theSetLivesInDeviceProtectedStorageSoALockedRebootCanReadIt() {
    store.alarms = listOf(alarm("fire", 1_000L))
    val prefs = context.createDeviceProtectedStorageContext().getSharedPreferences("pit_alarms", Context.MODE_PRIVATE)
    assertTrue(prefs.getString("alarms", "")!!.contains("\"fire\""))
  }

  @Test
  fun alarmsSavedByAnEarlierBuildInNormalStorageAreMovedOverOnce() {
    val old = context.getSharedPreferences("pit_alarms", Context.MODE_PRIVATE)
    assertTrue(old.edit().putString("alarms", "[${alarm("old", 5_000L).toJson()}]").commit())
    assertEquals(listOf("old"), store.alarms.map { it.id })
  }
}
