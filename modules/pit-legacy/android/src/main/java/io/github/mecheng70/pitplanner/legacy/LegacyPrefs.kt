package io.github.mecheng70.pitplanner.legacy

import android.content.Context
import android.content.SharedPreferences

/**
 * The 0.2.0 app's saved state. @capacitor/preferences kept one JSON string per key (gear, settings, draft,
 * rates, totalHours, rateLocks, activeCook, flags, update) in the SharedPreferences file "CapacitorStorage".
 * Same app ID and signing key, so the file is still in the data directory after the upgrade to 0.3.0.
 */
class LegacyPrefs(private val context: Context) {
  private fun prefs(name: String): SharedPreferences = context.getSharedPreferences(name, Context.MODE_PRIVATE)

  /** Every string entry, or an empty map when the app was never the Capacitor one. Nothing is changed. */
  fun read(): Map<String, String> {
    val out = sortedMapOf<String, String>()
    for ((key, value) in prefs(NAME).all) {
      // Capacitor only wrote strings; anything else is not its data.
      if (value is String) out[key] = value
    }
    return out
  }

  /**
   * Called only after the import into SQLite has committed: copy every entry to "CapacitorStorage.imported"
   * (kept until 0.4.0), then empty the original so the import cannot run twice. The original is emptied
   * only when the copy is safely on disk. Returns true when there was something to retire.
   */
  fun retire(): Boolean {
    val entries = read()
    if (entries.isEmpty()) return false
    val copy = prefs(RETIRED_NAME).edit()
    for ((key, value) in entries) copy.putString(key, value)
    if (!copy.commit()) return false
    return prefs(NAME).edit().clear().commit()
  }

  /** The kept copy (empty before `retire`). */
  fun retired(): Map<String, String> {
    val out = sortedMapOf<String, String>()
    for ((key, value) in prefs(RETIRED_NAME).all) {
      if (value is String) out[key] = value
    }
    return out
  }

  companion object {
    const val NAME = "CapacitorStorage"
    const val RETIRED_NAME = "CapacitorStorage.imported"
  }
}
