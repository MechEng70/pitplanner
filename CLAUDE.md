# Working on Pit Planner

- SPEC.md is the source of truth. The mockup canvas linked there is the source of truth for layout and look; look at the PNGs in docs/mockups/ before building a screen.
- Keep `engine/` pure: no DOM, no clock, no storage, no Capacitor imports. Pass time in. Add a unit test for every engine change and keep `npm test` green.
- Cooking rules live in `data/foods.json`. Prefer changing data over adding special cases in code.
- All instants are epoch milliseconds. All stored temps are F, weights lb; convert only for display (`engine/units.ts`).
- Alarms: use the custom setAlarmClock plugin described in SPEC.md section 6. After any plan change, cancel all alarms and reschedule from `plan.events`.
- Never commit signing keys (`*.jks`, `*.keystore`, `keystore.properties`).
- Do not fill in smoker specs without a source; leave `verified: false` entries blank.
- UI copy: plain, short, no exclamation marks except greetings. Straight apostrophes.
