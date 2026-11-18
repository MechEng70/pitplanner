# Home Assistant entities (Phase 0, read 2026-11-12)

Read-only survey of Jason's Home Assistant for the Pit Planner HA work (HA-INTEGRATION.md). Nothing in HA
was changed. The grill and probes were off, so every entity read `unavailable`; values, units and ranges
still need a live read during a cook.

## Pit Boss smoker (integration `pitboss`, ha-pitboss)

Device "PitBossSmoker", area Patio. Registry model PB850SPW2 = **Pit Boss Sportsman 850** (confirmed by Jason),
firmware 16.8.7. Catalog entry `pitboss-sportsman-850` in data/cookers.json; pick it in Gear (it replaces the 820).

| Use in Pit Planner | Entity |
|---|---|
| Pit temp, current and set point (climate) | `climate.patio_pitbosssmoker_grill_temperature` |
| Grill probe 1 | `sensor.patio_pitbosssmoker_probe_1` |
| Grill probe 2 | `sensor.patio_pitbosssmoker_probe_2` |
| Probes 3 and 4 (registry only, likely disabled, default names) | `sensor.pbc2_<id>_probe_3`, `sensor.pbc2_<id>_probe_4` |
| Probe targets (number) | `number.patio_pitbosssmoker_probe_1_target`, `..._probe_2_target` |
| Probe target reached | `binary_sensor.patio_pitbosssmoker_probe_1_target_reached`, `..._probe_2_target_reached` |
| Errors (blueprint: notify at once) | `binary_sensor.patio_pitbosssmoker_startup_error`, `_high_temperature_error`, `_fan_error`, `_igniter_error`, `_auger_error`, `_probe_1_error`, `_probe_2_error`, `_probe_3_error` |
| Out of pellets | `binary_sensor.patio_pitbosssmoker_no_pellets` |
| Connection to the grill | `binary_sensor.patio_pitbosssmoker_connectivity` |
| Running state | `binary_sensor.patio_pitbosssmoker_auger`, `_fan`, `_igniter`, `_meat_probe_control` |
| Grill unit (F/C) | `select.patio_pitbosssmoker_grill_temperature_unit` |
| Diagnostics | `sensor.patio_pitbosssmoker_controller_uptime`, `_controller_free_memory`, `_firmware_version` |

Never touched by Pit Planner (HA-INTEGRATION 3.4): `switch.patio_pitbosssmoker_module_power`,
`switch.patio_pitbosssmoker_prime`, `button.patio_pitbosssmoker_restart_controller`,
`button.patio_pitbosssmoker_request_fast_updates`, and the `pitboss.start_grill` action.

Not found: recipe progress, separate smoker/chamber temperature sensors.

## Chef iQ wireless probes (integration `chef_iq`, Bluetooth)

Three CQ60 probes, area Kitchen, renamed in HA to Probe 1-3. Same entities per probe (`<id>` = `8c86`, `3e2c`, `2a7b`):

| | Probe 1 (`8c86`) | Probe 2 (`3e2c`) | Probe 3 (`2a7b`) |
|---|---|---|---|
| Food temp (use this) | `sensor.cq60_8c86_food_temperature` | `sensor.cq60_3e2c_food_temperature` | `sensor.cq60_2a7b_food_temperature` |
| Ambient temp | `sensor.cq60_8c86_ambient_temperature` | `sensor.cq60_3e2c_ambient_temperature` | `sensor.cq60_2a7b_ambient_temperature` |

Also in the registry per probe (checked on Probe 1; likely disabled by default, they did not show in entity
search): `sensor.cq60_<id>_battery`, `_soc_temperature`, `_signal_strength`, `_probe_tip_1_temperature`,
`_probe_tip_2_temperature`, `_probe_tip_3_temperature`. The probe batteries were dead at the survey (2026-11-12);
recheck the `battery` entities once charged, and enable them if they are disabled, for the low-battery alert.

## Notifications

- Existing automation `automation.pitboss_probe_temp_notify`: on probe 1 or 2 "target reached" while module
  power is on, calls `script.notify_jason` and `script.notify_telegram` ("Probes have reached marked Temperature").
  It overlaps with the planned Pit Planner blueprint; Jason will disable it while the app's alerts are running.
- Five `notify.mobile_app_*` services exist. Which one is Jason's phone (and his wife's): Jason to confirm,
  or have the blueprint take a script like `script.notify_jason` as its notify input.

## Open from Phase 0

- ha-pitboss connection mode (`wss` / `local` / `ble`): not read; check the integration's options.
- Registry reads as a non-admin user (HA-INTEGRATION 4.3): tested 2026-11-18, both lists pass (the table at
  the end of this file). This survey itself used an admin connection.
- The MCP server used here is the ha-mcp add-on with full read and write tools over every entity, not HA's
  built-in MCP server limited to exposed entities (HA-INTEGRATION section 2). Only read tools were used.

## Token call checks (T-044 step 0, HA-INTEGRATION 8.1), run Wed 2026-11-18, 2:28 PM

With a long-lived token created by the dedicated `pitplanner` user (not an admin, not the owner: Home
Assistant's own answer to `auth/current_user`), Home Assistant 2026.11.2, from the development computer.
Read only. The address and the token live in a private file outside the repo and are in no log, doc or
commit; the check script prints pass or fail and counts only.

| # | Call | Result |
|---|---|---|
| 1 | WebSocket connect and `auth` with the token | **Pass**: `auth_ok` |
| 2 | `get_states` | **Pass**: 2303 states (24 temperature sensors, 2 climate entities) |
| 3 | `config/entity_registry/list` | **Pass** for the non-admin user: 4093 rows |
| 4 | `config/device_registry/list` | **Pass** for the non-admin user: 297 rows |
| 5 | `subscribe_events` for `state_changed` | **Pass**: subscribed, first event after 1 s |
| 5 | `subscribe_entities` (three temperature sensors) | **Pass**: subscribed, first message received |
| 6 | REST `GET /api/` with the bearer header | **Pass**: 200, `{"message":"API running."}`. With a wrong token: 401 |

So nothing a non-admin user is refused changes the design: discovery (4.3) can use both registry lists.

Also read:

- `auth/current_user` works for this user (name, `is_admin` false): the "User" row on the connected screen
  can be filled from it. It is one more call than the six above.
- `auth/refresh_tokens` works for this user and lists its own tokens (2, one of them long-lived). **Deleting
  the token at Home Assistant on Disconnect was not tested**: the delete call would end the token in use.
  That the user can list its tokens suggests it can delete them; test it with a throwaway token.
- The address in the private file was a bare host name with no scheme. `https://` plus the host answered
  (401 without a token); the port 8123 fallback was not needed. This is the case behind T-044's open choice
  "scheme when none typed".
- Not tested here: the same calls from the phone, on the home network by local address, and with the grill
  and probes switched on (every survey so far read them as unavailable).
