package io.github.mecheng70.pitplanner.legacy

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS bridge for LegacyPrefs. Both calls are synchronous: they run once, at the first start of 0.3.0. */
class PitLegacyModule : Module() {
  private val prefs: LegacyPrefs
    get() = LegacyPrefs(appContext.reactContext ?: throw Exceptions.ReactContextLost())

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)

    Function("readCapacitorPrefs") { prefs.read() }

    Function("retireCapacitorPrefs") { prefs.retire() }
  }

  companion object {
    const val MODULE_NAME = "PitLegacy"
  }
}
