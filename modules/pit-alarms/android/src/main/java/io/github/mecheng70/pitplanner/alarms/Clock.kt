package io.github.mecheng70.pitplanner.alarms

/** The wall clock the alarm code reads. Tests replace `source`; nothing else does. */
object Clock {
    @Volatile
    var source: () -> Long = { System.currentTimeMillis() }

    fun now(): Long = source()
}
