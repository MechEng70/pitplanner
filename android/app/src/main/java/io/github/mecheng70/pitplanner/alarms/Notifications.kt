package io.github.mecheng70.pitplanner.alarms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.github.mecheng70.pitplanner.MainActivity
import io.github.mecheng70.pitplanner.R
import java.util.Calendar

/** Step alerts: alarm sound, Done / +15 min / Open, full-screen at night or for critical steps. */
object Notifications {
    // Channel settings are fixed once created; bump the id to change sound or importance.
    const val CHANNEL = "steps_v1"
    const val EXTRA_ALARM = "pitAlarmId"

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        val ch = NotificationChannel(CHANNEL, "Cook steps", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Alarms for each cook step: fire, wrap, pull, serve."
            setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            setBypassDnd(true)
        }
        nm.createNotificationChannel(ch)
    }

    fun show(ctx: Context, alarmId: String, keys: List<String>, title: String, body: String, critical: Boolean, repeat: Int) {
        ensureChannel(ctx)
        val shownTitle = if (repeat in 1..AlarmScheduler.NAG_REPEATS) "Still waiting: $title" else title

        val open = PendingIntent.getActivity(
            ctx, alarmId.hashCode(),
            Intent(ctx, MainActivity::class.java).putExtra(EXTRA_ALARM, alarmId).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        fun action(act: String) = PendingIntent.getBroadcast(
            ctx, (alarmId + act).hashCode(),
            Intent(ctx, ActionReceiver::class.java).setAction(act)
                .putExtra(ActionReceiver.EXTRA_ID, alarmId)
                .putStringArrayListExtra(ActionReceiver.EXTRA_KEYS, ArrayList(keys))
                .putExtra(ActionReceiver.EXTRA_TITLE, title)
                .putExtra(ActionReceiver.EXTRA_BODY, body),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val b = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_pit)
            .setColor(0xFFFF8F4A.toInt())
            .setContentTitle(shownTitle)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .addAction(0, "Done", action(ActionReceiver.DONE))
            .addAction(0, "+15 min", action(ActionReceiver.SNOOZE))
            .addAction(0, "Open", open)

        // Overnight steps and critical ones take over the screen (sideloaded app; Play restricts this).
        if ((critical || overnight()) && canFullScreen(ctx)) b.setFullScreenIntent(open, true)

        runCatching { NotificationManagerCompat.from(ctx).notify(alarmId.hashCode(), b.build()) }
    }

    fun cancel(ctx: Context, alarmId: String) = NotificationManagerCompat.from(ctx).cancel(alarmId.hashCode())

    fun canFullScreen(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < 34 || ctx.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()

    private fun overnight(): Boolean {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        return h >= 22 || h < 7
    }
}
