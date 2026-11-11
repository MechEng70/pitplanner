package io.github.mecheng70.pitplanner;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.util.Collections;

import io.github.mecheng70.pitplanner.alarms.AlarmStore;
import io.github.mecheng70.pitplanner.alarms.AlarmsPlugin;
import io.github.mecheng70.pitplanner.alarms.Notifications;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmsPlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmIntent(intent);
    }

    /** Opened from a step alert (tap, Open, or full-screen at night): show over the lock screen. */
    private void handleAlarmIntent(Intent intent) {
        String id = intent == null ? null : intent.getStringExtra(Notifications.EXTRA_ALARM);
        if (id == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        new AlarmStore(this).queueAction("open", id, Collections.emptyList(), System.currentTimeMillis());
        intent.removeExtra(Notifications.EXTRA_ALARM);
    }
}
