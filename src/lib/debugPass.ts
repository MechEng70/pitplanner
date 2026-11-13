// Who may open the hidden alarm test screen. Dev builds: anyone, including the `pitplanner://debug` link the
// device tests use. Release builds: only the 5 taps on the Gear version, which grant a pass that the screen
// uses up as it opens. A link carries no pass, so in a release build it never opens the screen
// (Jason, 2026-11-13), not even right after the taps were used.
let pass = false;

/** The 5 taps on the Gear version (T-026) call this just before opening the debug route. */
export function grantDebugPass(): void {
  pass = true;
}

/** True when the debug screen may open now. A granted pass is used up by the asking. */
export function takeDebugPass(dev: boolean): boolean {
  const had = pass;
  pass = false;
  return dev || had;
}
