package io.github.mecheng70.pitplanner.alarms

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Placeholder until T-013 ports the 0.2.0 alarm plugin: registers the native module name only. */
class PitAlarmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)
  }

  companion object {
    const val MODULE_NAME = "PitAlarms"
  }
}
