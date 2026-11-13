package io.github.mecheng70.pitplanner.alarms

import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** What the native side keeps with the app dead: the alarm set, open repeats, queued actions, Quiet. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AlarmStoreTest : AlarmTestBase() {
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
    assertEquals(emptyList<Any>(), store.drainActions())
    assertEquals(0L, store.quietUntil)
  }

  @Test
  fun queuedActionsAreHandedOverOnceInOrder() {
    store.queueAction("done", "fire", listOf("fire::"), 10L)
    store.queueAction("snooze15", "wrap", listOf("wrap:b:p1"), 20L)
    val drained = store.drainActions()
    assertEquals(listOf("done", "snooze15"), drained.map { it.getString("type") })
    assertEquals(listOf("fire", "wrap"), drained.map { it.getString("alarmId") })
    assertEquals(listOf("wrap:b:p1"), drained[1].getJSONArray("keys").strings())
    assertEquals(20L, drained[1].getLong("at"))
    assertEquals(emptyList<Any>(), store.drainActions())
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
