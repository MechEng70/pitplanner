package io.github.mecheng70.pitplanner.alarms

import android.os.SystemClock

/** The clocks the alarm code reads. Tests replace `source` and `elapsedSource`; nothing else does. */
object Clock {
    @Volatile
    var source: () -> Long = { System.currentTimeMillis() }

    /** Milliseconds since boot, sleep included: it does not move when someone changes the time (ring log, T-068). */
    @Volatile
    var elapsedSource: () -> Long = { SystemClock.elapsedRealtime() }

    fun now(): Long = source()

    fun elapsed(): Long = elapsedSource()
}
