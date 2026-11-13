// Memory limits for Android builds (Jason, 2026-11-12): a build with the test emulator open ran this
// 30 GB machine out of memory. The generated gradle.properties already capped Gradle's heap at 2 GB, yet the
// daemon held 5.8 GB and the Kotlin daemon 2.1 GB: with 20 cores Gradle starts 20 workers and the JVM sizes
// its GC threads, code cache and direct buffers to match. So the limits cover those too. Pure: unit tested.

export interface GradleProperty {
  type: 'property';
  key: string;
  value: string;
}
type Item = GradleProperty | { type: string };

export const GRADLE_MEMORY: Record<string, string> = {
  // Gradle daemon: 2 GB heap, and bounds on what sits outside the heap.
  'org.gradle.jvmargs':
    '-Xmx2g -XX:MaxMetaspaceSize=768m -XX:ReservedCodeCacheSize=256m -XX:MaxDirectMemorySize=512m' +
    ' -XX:ParallelGCThreads=4 -XX:ConcGCThreads=2 -XX:+HeapDumpOnOutOfMemoryError',
  // Kotlin compile daemon (its own process; without this it copies Gradle's arguments).
  'kotlin.daemon.jvmargs': '-Xmx1536m -XX:MaxMetaspaceSize=512m -XX:ParallelGCThreads=4 -XX:ConcGCThreads=2',
  // At most 6 tasks at once (default: one per core, 20 here), which also bounds the C++ compilers.
  'org.gradle.workers.max': '6',
  // An idle daemon leaves after 10 minutes instead of 3 hours.
  'org.gradle.daemon.idletimeout': '600000',
};

/** Set (or replace) the memory properties; everything else in gradle.properties is kept in place. */
export function applyGradleMemory<T extends Item>(items: readonly T[]): (T | GradleProperty)[] {
  const isOurs = (i: Item): i is GradleProperty => i.type === 'property' && (i as GradleProperty).key in GRADLE_MEMORY;
  const kept: (T | GradleProperty)[] = items.filter(i => !isOurs(i));
  for (const [key, value] of Object.entries(GRADLE_MEMORY)) kept.push({ type: 'property', key, value });
  return kept;
}
