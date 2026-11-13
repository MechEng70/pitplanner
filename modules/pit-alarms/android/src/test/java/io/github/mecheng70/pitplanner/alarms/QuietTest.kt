package io.github.mecheng70.pitplanner.alarms

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Quiet alerts and repeats: the rule the scheduler and the receiver apply (regression for the 0.2.0 gap,
 * where an overdue step kept repeating through Quiet). The scheduler and receiver tests come in T-014.
 */
class QuietTest {
  private val min = 60_000L
  private val now = 1_800_000_000_000L

  @Test
  fun aRepeatDueInsideTheWindowMovesToItsEnd() {
    assertEquals(now + 30 * min, Quiet.defer(now + 10 * min, quietUntil = now + 30 * min))
  }

  @Test
  fun aRepeatDueAfterTheWindowKeepsItsTime() {
    assertEquals(now + 40 * min, Quiet.defer(now + 40 * min, quietUntil = now + 30 * min))
  }

  @Test
  fun withQuietOffNothingMoves() {
    assertEquals(now + 10 * min, Quiet.defer(now + 10 * min, quietUntil = 0L))
    assertFalse(Quiet.active(now, quietUntil = 0L))
  }

  @Test
  fun theWindowIsOpenUntilItsEndAndClosedFromThenOn() {
    assertTrue(Quiet.active(now, quietUntil = now + 1))
    assertFalse(Quiet.active(now, quietUntil = now))
  }

  @Test
  fun endingQuietEarlyBringsAHeldRepeatBackToOneIntervalFromNow() {
    assertEquals(now + 10 * min, Quiet.release(now + 30 * min, now, every = 10 * min))
    // One that was due sooner anyway keeps its time.
    assertEquals(now + 4 * min, Quiet.release(now + 4 * min, now, every = 10 * min))
  }

  @Test
  fun registersUnderTheNameTheJsSideUses() {
    assertEquals("PitAlarms", PitAlarmsModule.MODULE_NAME)
  }
}
