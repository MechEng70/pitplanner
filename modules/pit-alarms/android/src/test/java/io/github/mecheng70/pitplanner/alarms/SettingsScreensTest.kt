package io.github.mecheng70.pitplanner.alarms

import android.net.Uri
import android.provider.Settings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

/** Where each alert check sends the user, and the permissions the module asks for (T-102, Google Play). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class SettingsScreensTest {
  private val pkg = "io.github.mecheng70.pitplanner"
  private val pkgUri = Uri.parse("package:$pkg")

  /** The module's own manifest; Gradle runs unit tests in the module's android folder. */
  private val manifest = File("src/main/AndroidManifest.xml").readText()
  private fun permissionLines() = manifest.lines().filter { "<uses-permission" in it }.map { it.trim() }

  @Test
  fun batteryOpensPitPlannersOwnAppInfoWhichNeedsNoPermission() {
    // Play allows REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (and the one-tap question it unlocks) for a few app
    // types only. App info needs no permission: from there the user opens App battery usage (Jason, 2026-11-20).
    val i = SettingsScreens.intent("battery", pkg)!!
    assertEquals(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, i.action)
    assertEquals(pkgUri, i.data)
  }

  @Test
  fun theModuleDoesNotAskForTheBatteryPermission() {
    assertEquals(emptyList<String>(), permissionLines().filter { "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" in it })
  }

  @Test
  fun theExactAlarmAndFullScreenPermissionsStayAsTheyAre() {
    val lines = permissionLines()
    for (want in listOf(
      """<uses-permission android:name="android.permission.USE_EXACT_ALARM" />""",
      """<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />""",
      """<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />""",
    )) assertEquals(want, 1, lines.count { it == want })
  }

  @Test
  fun fullScreenOpensTheAppsOwnSwitchFromAndroid14() {
    val i = SettingsScreens.intent("fullScreen", pkg, sdk = 34)!!
    assertEquals(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, i.action)
    assertEquals(pkgUri, i.data)
    // Android 13 and older have no such switch: full-screen alerts cannot be turned off there.
    assertNull(SettingsScreens.intent("fullScreen", pkg, sdk = 33))
  }

  @Test
  fun exactAlarmsAndNotificationsOpenTheAppsOwnScreens() {
    val exact = SettingsScreens.intent("exactAlarm", pkg, sdk = 34)!!
    assertEquals(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, exact.action)
    assertEquals(pkgUri, exact.data)
    assertNull(SettingsScreens.intent("exactAlarm", pkg, sdk = 30))
    val n = SettingsScreens.intent("notifications", pkg)!!
    assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, n.action)
    assertEquals(pkg, n.getStringExtra(Settings.EXTRA_APP_PACKAGE))
  }

  @Test
  fun anUnknownScreenIsRefused() {
    assertThrows(IllegalArgumentException::class.java) { SettingsScreens.intent("camera", pkg) }
  }
}
