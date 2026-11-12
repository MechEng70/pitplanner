package io.github.mecheng70.pitplanner.alarms

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Placeholder (T-004 prep): proves the gate compiles this module and runs its JUnit tests through Gradle
 * (tools/test-android.sh). T-014 replaces it with the scheduler and store tests.
 */
class PitAlarmsModuleTest {
  @Test
  fun registersUnderTheNameTheJsSideUses() {
    assertEquals("PitAlarms", PitAlarmsModule.MODULE_NAME)
  }
}
