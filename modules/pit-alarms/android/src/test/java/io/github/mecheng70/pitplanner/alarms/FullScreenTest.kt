package io.github.mecheng70.pitplanner.alarms

import android.app.Notification
import android.app.NotificationManager
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowNotificationManager

/** Android 14+: "Full-screen notifications" for the app, as the user (or Google Play) has set it. */
@Implements(NotificationManager::class)
class FullScreenSwitch : ShadowNotificationManager() {
  @Implementation(minSdk = 34)
  protected fun canUseFullScreenIntent(): Boolean = allowed

  companion object {
    var allowed = true
  }
}

/**
 * Full-screen alerts turned off (T-102; Google Play can do it for an app it does not accept as an alarm app):
 * the alerts check sees it, and a step still rings as a high-priority notification.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], shadows = [FullScreenSwitch::class])
class FullScreenTest : AlarmTestBase() {
  @After
  fun allowAgain() {
    FullScreenSwitch.allowed = true
  }

  /** A critical step rings: critical steps ask for the full screen at any hour. */
  private fun ringCritical(): Notification {
    AlarmScheduler.replaceAll(context, listOf(alarm("fire", now() + min, "fire::", critical = true)))
    advance(min)
    deliver(scheduled().single())
    return notifications().single()
  }

  @Test
  fun theCheckReadsAndroidsSwitch() {
    assertTrue(Notifications.canFullScreen(context))
    FullScreenSwitch.allowed = false
    assertFalse(Notifications.canFullScreen(context))
  }

  @Test
  @Config(sdk = [33], shadows = [FullScreenSwitch::class])
  fun before14ThereIsNoSwitchAndFullScreenIsAlwaysOn() {
    FullScreenSwitch.allowed = false
    assertTrue(Notifications.canFullScreen(context))
  }

  @Test
  fun withFullScreenOffAStepStillRingsAsAHighPriorityNotification() {
    FullScreenSwitch.allowed = false
    val n = ringCritical()
    assertEquals("Title fire", n.title())
    assertNull(n.fullScreenIntent)
    @Suppress("DEPRECATION") // what phones before channels go by; NotificationCompat sets it from PRIORITY_MAX
    assertEquals(Notification.PRIORITY_MAX, n.priority)
    assertEquals(Notification.CATEGORY_ALARM, n.category)
    assertEquals(Notifications.CHANNEL, n.channelId)
    val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(Notifications.CHANNEL)
    assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.importance)
    assertEquals(listOf("Done", "+15 min"), n.actions.map { it.title.toString() })
    // And it rang for real: logged as posted, repeating until Done.
    assertTrue(rings.single().posted)
    assertEquals(listOf("fire"), store.nags.map { it.alarmId })
  }

  @Test
  fun withFullScreenOnACriticalStepTakesOverTheScreen() {
    assertNotNull(ringCritical().fullScreenIntent)
  }
}
