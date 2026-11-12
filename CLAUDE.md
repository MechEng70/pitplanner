# Working on Pit Planner

- Stack: Expo SDK 58 + React Native + TypeScript (development builds; `npm run android`). `android/` is generated
  by `npx expo prebuild` and git-ignored: change native config in `app.config.ts`, `plugins/` or `modules/`.
  `legacy/` is the 0.2.0 Capacitor app, reference only: read it to see how a screen behaves, never edit or build it.
- SPEC.md is the source of truth. The mockup canvas linked there is the source of truth for layout and look; look at the PNGs in docs/mockups/ before building a screen.
- Keep `engine/` pure: no React Native, Expo or native imports, no clock, no storage. Pass time in. Add a unit test for every engine change and keep `npm test` green.
- Cooking rules live in `data/foods.json`. Prefer changing data over adding special cases in code.
- All instants are epoch milliseconds. All stored temps are F, weights lb; convert only for display (`engine/units.ts`).
- Alarms: use the `pit-alarms` Expo module (setAlarmClock) described in SPEC.md section 6, through `src/platform/`. After any plan change, cancel all alarms and reschedule from `plan.events`.
- Never commit signing keys (`*.jks`, `*.keystore`, `keystore.properties`).
- Do not fill in smoker specs without a source; leave `verified: false` entries blank.
- UI copy: plain, short, no exclamation marks except greetings. Straight apostrophes.

# Plan

- Engineering plan: `docs/design/TECH-DESIGN.md` (architecture, layer rules, platform services, alarms,
  live-cook states, HA, security, release, tests), `docs/design/TASKS.md` (T-001...), `docs/design/WBS.md`
  (phases, critical path). Work one task at a time; update its status line when done.

# Quality gate (mandatory for every task)

- Write unit tests for new logic and a regression test for every bug fixed (write it failing first).
  Engine: node:test (`engine/*.test.ts`). App logic and UI: Jest + React Native Testing Library (`src/**/*.test.{ts,tsx}`).
  Native Kotlin: JUnit, Robolectric where Android classes are involved (`modules/*/android/src/test/`).
- After each task run `npm run check` and fix everything it reports. It runs, in order, and stops at the
  first failure:
  1. Prettier (format, then check)
  2. ESLint (TypeScript and React Native rules, zero warnings)
  3. TypeScript typecheck
  4. The full test suite: engine + UI + Android (unit and regression, not only new tests)
  5. Semgrep (TypeScript, Kotlin and secrets rulesets)
  6. Snyk: `snyk test --all-projects --severity-threshold=high`, then `snyk code test --severity-threshold=high`
- A task is not done until `npm run check` passes. Report its summary (the "check summary" block) at the end
  of each task.
- No high or critical Semgrep or Snyk finding may be left open. A finding judged a false positive (or not
  shipped) gets a written justification in `docs/design/SECURITY-EXCEPTIONS.md` before it is excluded. Never
  remove or skip a gate step to get a pass.
- If the Gradle part of the Snyk scan fails, run `npx expo prebuild --platform android --no-install` (if
  `android/` is missing), then `cd android && ./gradlew assembleDebug` once and retry before reporting a problem.
- Snyk and GitHub tokens and the Snyk org ID come from the user's own CLI config. Never write them into the
  repo, scripts or docs.
- `npm run snyk:monitor` (`snyk monitor --all-projects`) is not part of the check. Run it only after a release
  or a push to main; it is a step in the release process (TECH-DESIGN section 11).
