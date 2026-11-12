# Pit Planner + Home Assistant: integration plan (v2)

## Do first: cook timing fix (before any Home Assistant work)

Problem on the phone: a 12 lb brisket plans about 15 hr at 225F (published 1.25 hr/lb) and nothing can be changed. Size-adjusted is permanently locked because it needs 3 logged cooks and End cook and history aren't built yet. Jason's pit actually runs about 0.75 hr/lb (9 hr for 12 lb).

1. Food details: replace the Timing switch with three options, available for every food:
   a. **Hours per pound** (weight-based foods: brisket, pork butt, brisket-style tri-tip). Editable stepper, 0.05 hr/lb steps, prefilled from: user override > learned > published default, with the source shown ("your setting", "learned from 2 cooks", "published estimate"). Range 0.3-2.5; outside 0.5-1.6 show a soft warning, never block.
   b. **Total hours.** User types the total time on heat they expect for this cook (e.g. 9 hr). Used as-is: no temp or wrap scaling, phases split by their normal fractions. If the user later changes smoker temp, keep the hours and show "Total hours fixed. Temp change does not adjust it." Works for every food, including ribs, wings and chicken.
   c. **Size-adjusted** (weight-based foods). Unlock it now: with no history, anchor it to the user's hr/lb at the food's reference weight (brisket 12 lb, butt 8 lb) and use exponent 0.67. Learning refines it later. Show "Estimate. Gets better after a few logged cooks."
2. A checkbox under Timing: "Use for future [food] on [smoker]." Checked saves to rateOverrides (hr/lb) or a saved default total hours for that food; unchecked applies to this cook only. Gear > Cook rates shows and edits the same saved values.
3. The result card updates live and shows the method used ("9 hr on heat, your rate 0.75 hr/lb").
4. Engine: add timingModel 'totalHours' with totalHours on ItemInput; add a per-item rate override; remove the 3-cook lock on sizeAdjusted. Keep the engine pure. Tests: total hours used exactly and unaffected by temp; per-item rate beats the saved rate; size-adjusted works with zero history and matches hr/lb at the reference weight; a 12 lb brisket at 0.75 hr/lb plans 9 hr.
5. Default for new users stays the published rate, but the first time a weight-based food is added, show one line: "Published estimate. Most pellet smokers run faster. Set your own rate or total hours."
6. Text-size rule still applies: times and numbers never truncate at 115% or 130%.
7. Update SPEC.md sections 1 and 4 to match (timing model decision and rates).

Done when: phone screenshots of Brisket details in each of the three modes, and the Plan screen with Jason's brisket at 0.75 hr/lb (fire around 6:20 AM for a 5:00 PM serve).

Order for tomorrow: this timing fix, then the beta release to friends (signed APK on GitHub Releases), then Home Assistant Phase 0 below.

---

Handoff for Claude Code. Put this file at `docs/HA-INTEGRATION.md` and treat it as an addendum to SPEC.md section 11.

## 0. Two different connections

| | What | Why |
|---|---|---|
| **A. Dev-time** | Claude Code talks to Jason's Home Assistant through HA's built-in MCP Server | Lets Claude Code find the real entity IDs, read live values while building, and check the blueprint against real data. Nothing ships to users. |
| **B. Runtime** | The Pit Planner app signs in to the user's HA (e.g. https://ha.glithero.icu) with an HA username and password through HA's own login page, then uses HA's REST and WebSocket APIs | Live probe and pit temps in the app, and temperature-triggered alerts from HA. Optional per user; off by default. Friends without HA lose nothing. |

Keep them separate. The app never uses MCP, and Claude Code never needs the app's login.

## 1. What Jason's HA already has

**Pit Boss (custom integration `dknowles2/ha-pitboss`)**
- `climate.*`: grill temperature, current and target, HVAC action. Setting target is possible; values snap to what the board accepts.
- `sensor.*`: probe temperatures, recipe progress, diagnostics. Optional grill, smoker and chamber temps (some disabled by default).
- `number.*`: per-probe target temps, optional grill setpoint.
- `switch.*`: module power (off only) and primer motor.
- `binary_sensor.*`: errors, fan, igniter, auger, connectivity.
- Lighting the grill is only possible through the opt-in `pitboss.start_grill` action. **Pit Planner never calls it.**
- Connection mode matters: `wss` (default) goes through the vendor relay and needs internet; `local` (HTTP, if the firmware supports it) and `ble` do not. Prefer `local` or `ble` for an overnight cook.

**Chef iQ probes (core integration `chef_iq`)**
- Sensors: food temperature, ambient temperature, battery (plus disabled-by-default extras). IDs look like `sensor.cq60_xxxx_food_temperature`.
- Passive Bluetooth: values update only while the probe is awake and advertising; after a few minutes of silence the sensors go `unavailable`.
- Read-only.

**Task for Claude Code in Phase 0:** list the actual entity IDs and write them to `docs/ha-entities.md` (no tokens, no URLs with secrets).

## 2. Phase 0: connect Claude Code to HA (dev-time)

1. In HA: Settings > System > AI, enable the Model Context Protocol server (or add the "Model Context Protocol Server" integration).
2. Limit what it exposes: Settings > Voice assistants > Expose. Expose only the Pit Boss and Chef iQ entities and the phone notify service. Nothing else in the house.
3. Claude Code only connects to MCP servers over HTTPS, so use HA's remote URL (Nabu Casa or Jason's own reverse proxy), not `http://homeassistant.local:8123`.
4. In the project folder:
   ```
   claude mcp add --transport http homeassistant https://<your-ha-remote-url>/api/mcp
   ```
   Then run `/mcp` inside Claude Code and sign in to HA (OAuth).
5. Claude Code: read-only use. List entities, read states, write `docs/ha-entities.md`. Do not change HA settings, automations or devices through MCP. Blueprints are written as files in the repo for Jason to import.

## 3. Runtime architecture (the app)

**Rule: the app owns the plan and the clock; HA owns temperatures.**

- The app keeps its own `setAlarmClock` alarms for every time-based step. These work with no HA at all.
- HA runs 24/7 next to the grill and probes, so HA sends temperature-based alerts (wrap at 165F, pull at 203F, pit dropped) through the HA Companion app. This does not depend on the Pit Planner app staying awake.
- No step is alerted by both. Time steps: app. Temperature events: HA. The app shows HA's events in its timeline when it is open.

```
Pit Planner app --(REST: POST /api/states/sensor.pit_planner_cook, token)--> HA
HA blueprint watches probe + pit sensors vs targets in that sensor's attributes
HA --(notify.mobile_app_<phone>)--> Jason's phone
Pit Planner app <--(WebSocket subscribe, while open)-- HA live temps
```

### 3.1 App to HA: publish the cook
- On Start cook, every adjustment and End cook, the app writes `sensor.pit_planner_cook` via `POST /api/states/...` with state `cooking` / `idle` and attributes: serve time, smoker set point, and per item: name, probe entity, next temperature event (e.g. wrap 165F, pull 203F), hold limits.
- This state is not persistent across HA restarts. The app re-publishes on open and every 10 min during a cook; the blueprint treats a missing sensor as "no active cook."

### 3.2 HA blueprint: `blueprints/pit_planner_cook_watcher.yaml` (in the repo)
Inputs: pit climate entity, probe sensors, notify service. Triggers and alerts:
- Probe crosses the item's next target (wrap, pull): notify "Brisket at 166F. Time to wrap."
- Pit current temp more than 40F below target for 10 min while cooking: notify "Smoker dropped to 180F. Pit went out?"
- Any Pit Boss error binary sensor on: notify immediately.
- Probe `unavailable` for 10 min during a cook: notify "Lost the brisket probe."
- Probe battery under 15%: notify once.
Thresholds come from the published sensor attributes, so the blueprint needs no edits per cook.

### 3.3 HA to app: live temps and suggestions (app open)
- WebSocket `subscribe_entities` for the mapped entities; fall back to REST polling every 15 s.
- Live Cook shows probe temp per food and pit actual vs set point, each with "updated 20 s ago." Stale over 2 min shows grey, never a guessed value.
- When a probe reaches a check step's target, the Next up card says "Brisket hit 166F" and offers Done. It never marks a step done by itself.
- Pit-drop detection offers "Pit went out?" which opens the existing Pit went out flow.
- Rate learning can use actual probe-reached times instead of button taps when available.

### 3.4 Control of the grill
- v2 is read-only toward the grill.
- Later, optional: "Set smoker to 400F" as a button on the wings step that calls `climate.set_temperature`, only on an explicit tap with a confirm, only while the grill is already running. Never automatic, never ignition, never `pitboss.start_grill`, never the power switch.

## 4. Onboarding: Gear > Home Assistant > Connect

### 4.1 Recommended HA user (done once by the HA owner, in HA)
- Settings > People > Add person, e.g. "Pit Planner", with "Allow login" on, a username such as `pitplanner` and a password. Not an administrator. Leave "Can only log in from the local network" off if the app should work away from home.
- Why a separate user: you can see what Pit Planner did in HA's logbook, and you can disable or delete that one user to cut the app off without touching anything else.
- Be honest in the UI help text: HA has only admin and non-admin. A non-admin user can still read and control every entity in the house. Pit Planner limits itself in code (read-only toward everything; see 3.4); the HA user does not enforce that.

### 4.2 Sign-in (HA's standard login for third-party apps, no pasted tokens)
1. Screen: "Your Home Assistant address" with one field, e.g. `ha.glithero.icu`. The app adds `https://` and checks `/api/` responds.
2. The app opens HA's own login page in an Android Custom Tab: `/auth/authorize?client_id=...&redirect_uri=...&state=...`. The user types the HA username and password there (and MFA if enabled). The app never sees the password.
3. HA redirects back to the app with a code; the app exchanges it at `/auth/token` (`grant_type=authorization_code`) for an access token (about 30 min) and a refresh token.
4. The app refreshes the access token with `grant_type=refresh_token` whenever it expires or a call returns 401. If refresh fails, the connection shows "Signed out" and asks to sign in again.
5. Disconnect in Gear posts the refresh token to `/auth/revoke`, then deletes it locally.

Requirements for this to work:
- **client_id** must be a website. Use a GitHub Pages page: `https://mecheng70.github.io/pitplanner/` (repo `MechEng70/pitplanner`, `docs/` or `gh-pages`).
- That page's `<head>`, within the first 10 kB, contains `<link rel="redirect_uri" href="pitplanner://auth-callback">`.
- Android: intent filter for the `pitplanner://auth-callback` scheme on the main activity; Capacitor `App` plugin `appUrlOpen` hands the code to the app.
- Use `state` to carry the HA address and a random nonce; reject a callback whose nonce doesn't match.
- Store the HA address and refresh token with Android Keystore-backed encrypted storage. Access token in memory only. Never logged, never in a `.pitplan`, never in the repo.
- Accept `https://` only for remote addresses. For a LAN address (`http://192.168.x.x:8123`), allow cleartext only for that host via network security config, with a warning. Prefer an IP to `homeassistant.local`.

### 4.3 Discovery: "Here's what we found"
After sign-in the app reads, over the WebSocket API:
- `get_states` for current values and units.
- Entity registry and device registry lists, to group entities by device and read each device's manufacturer and model. (Phase 0 task: confirm these registry reads work for a non-admin user on Jason's HA; if not, fall back to grouping by entity ID prefix and the `pitboss` / `chef_iq` platform names from state attributes, and let the user type the model.)

It then shows, already filled in:
- **Smoker:** each Pit Boss device found (integration `pitboss`) with its model, e.g. "Pit Boss PB820..." If one, preselected; if several, a dropdown. Its climate entity becomes the pit temp (current and set point). The model also offers to set the app's smoker profile in Gear.
- **Smoker probes:** every probe sensor that Pit Boss device has. The number comes from what the device exposes (Jason's: 2). Each row shows its live reading or "not plugged in" when unavailable. User can rename ("Grill probe 1").
- **Wireless probes:** each Chef iQ probe (integration `chef_iq`), using its food temperature sensor, with ambient and battery shown underneath. Live reading or "asleep" when unavailable.
- **+ Add a temperature sensor:** a searchable dropdown of every `sensor.*` with `device_class: temperature` (or a F/C unit), filtered as you type, showing friendly name, entity ID and live value. Typing a full entity ID that isn't listed is allowed and validated against `get_states`.
- Each sensor has an on/off switch: "Use in Pit Planner." Any number of probes.
- Save writes `haConfig` (address, smoker climate entity, probe list with labels and entity IDs). Nothing else from HA is stored.

### 4.4 At Start cook
- For each food, a "Probe" dropdown listing the saved probes (and "None"), defaulting to last time's choice for that food. Two foods can't share a probe; a warning if a food has no probe.
- The mapping goes into the published `sensor.pit_planner_cook` attributes (3.1) so the HA blueprint watches the right sensor.

### 4.5 Screens to mock before building
1. Gear > Home Assistant (not connected): what it does, "Connect."
2. Address entry.
3. HA login page (HA's own, in a Custom Tab; no mock needed).
4. "Here's what we found": Smoker, Smoker probes, Wireless probes, + Add a temperature sensor.
5. Add a temperature sensor: searchable list.
6. Start cook: probe per food.
7. Gear > Home Assistant (connected): address, signed-in user, status, probes, Rescan, Disconnect.

## 5. Failure modes to add to SPEC section 7

| Failure | What the app does |
|---|---|
| HA unreachable (away from home, HA down) | Banner "Home Assistant offline, time alerts still active." Time alarms unaffected. Retry with backoff. |
| Probe asleep or out of Bluetooth range | Show "no reading," never interpolate. HA notifies after 10 min during a cook. |
| Pit Boss on `wss` and internet drops | Grill entities go unavailable; same as above. Recommend `local` or `ble` in the setup screen. |
| HA restarts mid-cook | `sensor.pit_planner_cook` disappears; app re-publishes within 10 min or on open. |
| Refresh token revoked, HA user disabled or password changed | "Signed out of Home Assistant" banner with Sign in again; HA features off; time alarms unaffected. |
| Probe entity renamed or removed in HA | Mark that probe "missing" in Gear and at Start cook; offer Rescan. |
| Wrong probe mapped to a food | Live Cook shows the probe name beside the reading; one tap to remap. |
| Duplicate alerts | Time steps: app only. Temperature events: HA only. |

## 6. Build order for Claude Code

1. **Phase 0:** MCP connection, `docs/ha-entities.md`.
2. **Phase 1:** GitHub Pages client_id page, HA sign-in (4.2), discovery and probe selection (4.3), probe per food (4.4), live temps on Live Cook. Read-only.
3. **Phase 2:** publish `sensor.pit_planner_cook`; write and document the blueprint; Jason imports and tests it with a real probe in hot water (no cook needed).
4. **Phase 3:** probe-driven suggestions, pit-drop prompt, probe times feeding rate learning.
5. **Phase 4 (optional):** confirmed set-temp button.

Engine stays pure: add `engine/probe.ts` with functions like `nextTempEvent(plan, itemId)` and `suggestion(plan, readings, now)`, unit-tested with fake readings. All HA network code lives in `src/lib/ha/`.

## 7. Open items for Jason

- HA address for Claude Code's MCP connection and for testing the app: https://ha.glithero.icu.
- Create the `pitplanner` HA user (4.1) before Phase 1 testing.
- ha-pitboss connection mode on the 820 (`wss`, `local` or `ble`).
- Which phone(s) have the HA Companion app (notify service names).
- Chef iQ probe model(s) (the core integration documents the CQ60).
