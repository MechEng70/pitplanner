package io.github.mecheng70.pitplanner.alarms

/** Quiet alerts and repeats (nags). Pure: the times are passed in. */
object Quiet {
    /** True while the quiet window is open. `quietUntil` is 0 when Quiet is off. */
    fun active(now: Long, quietUntil: Long): Boolean = now < quietUntil

    /** When a repeat due at `nextAt` may ring: not before the quiet window ends. */
    fun defer(nextAt: Long, quietUntil: Long): Long = maxOf(nextAt, quietUntil)

    /** Quiet ended early: a repeat that was held back rings one interval from now at the latest. */
    fun release(nextAt: Long, now: Long, every: Long): Long = minOf(nextAt, now + every)
}
