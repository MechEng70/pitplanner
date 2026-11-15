# Backlog for the next version (after 0.3.0)

Jason, 2026-11-14: "we should keep a backlog for next version so we can triage." Anything that is not part
of 0.3.0 goes here, one line each, with its task in `TASKS.md` when it has one. Nothing here is scheduled or
decided until Jason triages it. New ideas that come up during the port are added here, not built.

## From Jason's cooks

| Item | Task | From | State |
|---|---|---|---|
| Low and slow for tough cuts: a brisket heated far faster than the plan (cut and thickness, a recommended smoker temp, re-timing on a temp change, re-timing from probes) | T-060 | Cook of 2026-11-14 | Four candidates, none decided; needs sourced numbers. Phone logs and the two Pit Boss charts still to be read with him. |
| A name of the user's own for a food ("Dad's brisket"), replacing the default label | T-062 | Cook of 2026-11-14 | Wanted; needs a mockup. The default label ("11.5 lb brisket") is in 0.3.0 as T-061. |
| Go back on the full timeline to set what was missed: tap a step, adjust it | none yet | Cook of 2026-11-14 | Next version (Jason, 2026-11-14). Taking back a step marked Done by mistake is not here: it is in 0.3.0 as T-063. Needs a mockup. |

- **A debug switch and "send to developer"** (Jason, 2026-11-15, after his 2026-11-14 cook was missing from
  0.2.0's history and nothing on the phone could show why): a way to turn on debugging in the app, and a
  feedback or send-to-developer element that gets the app's data and log to the developer. Not designed.
  Whether any of it goes into 0.3.0 is his call (0.3.0 already has Export my data on the migration error
  screen and the hidden debug screen behind 5 taps on the Gear version, T-026). See TASKS T-064.

## Planned before, not in 0.3.0

| Item | Task | State |
|---|---|---|
| Lane chart full screen | T-040 | Mockup first |
| Oven warming drawer: use it or drop it | T-041 | Jason decides |
| Home Assistant: sign-in, sensors, probes on Live cook, publish the cook, blueprint, suggestions, learning from probes, set-temp button | T-042 to T-055 | Plan in `docs/HA-INTEGRATION.md`; mockups first (T-042) |
| iOS readiness (interfaces only, no Xcode work) | T-056 | Depends on T-015, T-030, T-045 |

## Maintenance (has a date, not a version)

| Item | Task | State |
|---|---|---|
| Clear the build-tool Snyk findings (SE-001) | T-057 | Deadline 2027-02-01 |
