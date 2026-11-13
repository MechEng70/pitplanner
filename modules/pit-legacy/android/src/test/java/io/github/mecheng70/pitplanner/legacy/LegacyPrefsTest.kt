package io.github.mecheng70.pitplanner.legacy

import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class LegacyPrefsTest {
  private val context: Context = RuntimeEnvironment.getApplication()
  private val legacy = LegacyPrefs(context)

  /** What a 0.2.0 install holds: one JSON string per key (shapes only, no personal data). */
  private val saved = mapOf(
    "gear" to """{"smoker":{"id":"pb820","name":"Pit Boss 820"}}""",
    "settings" to """{"temp":"F","weight":"lb"}""",
    "rates" to """{"brisket":0.75}""",
  )

  private fun seed(entries: Map<String, String> = saved) {
    val edit = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
    for ((key, value) in entries) edit.putString(key, value)
    assertTrue(edit.commit())
  }

  @Test
  fun readsTheEntriesTheCapacitorAppSaved() {
    seed()
    assertEquals(saved, legacy.read())
  }

  @Test
  fun noCapacitorDataIsAnEmptyMap() {
    assertEquals(emptyMap<String, String>(), legacy.read())
  }

  @Test
  fun readingChangesNothing() {
    seed()
    legacy.read()
    legacy.read()
    assertEquals(saved, legacy.read())
    assertEquals(emptyMap<String, String>(), legacy.retired())
  }

  @Test
  fun entriesThatAreNotStringsAreLeftOut() {
    seed()
    context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit()
      .putInt("someoneElsesNumber", 3).putBoolean("flag", true).commit()
    assertEquals(saved, legacy.read())
  }

  @Test
  fun otherPreferenceFilesAreNotRead() {
    context.getSharedPreferences("pit_alarms", Context.MODE_PRIVATE).edit().putString("gear", "not this").commit()
    assertEquals(emptyMap<String, String>(), legacy.read())
  }

  @Test
  fun retireKeepsACopyAndEmptiesTheOriginal() {
    seed()
    assertTrue(legacy.retire())
    assertEquals(emptyMap<String, String>(), legacy.read())
    assertEquals(saved, legacy.retired())
    assertEquals(saved, context.getSharedPreferences("CapacitorStorage.imported", Context.MODE_PRIVATE).all)
  }

  @Test
  fun retireWithNothingToRetireDoesNothing() {
    assertFalse(legacy.retire())
    assertEquals(emptyMap<String, String>(), legacy.retired())
  }

  @Test
  fun retiringTwiceKeepsTheCopy() {
    seed()
    assertTrue(legacy.retire())
    assertFalse(legacy.retire())
    assertEquals(saved, legacy.retired())
  }

  @Test
  fun registersUnderTheNameTheJsSideUses() {
    assertEquals("PitLegacy", PitLegacyModule.MODULE_NAME)
  }
}
